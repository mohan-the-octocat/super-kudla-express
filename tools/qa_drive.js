/**
 * @fileoverview Real-time Chrome DevTools Protocol (CDP) QA harness for Super Kudla Express.
 * Launches headless Chrome with SwiftShader WebGL, drives the real-time requestAnimationFrame
 * loop for a specified number of seconds, logs per-second game telemetry, captures a PNG
 * screenshot, and exits non-zero if any uncaught runtime exception occurs.
 *
 * Usage:
 *   node tools/qa_drive.js <name> "<query>" <seconds>
 * Example:
 *   node tools/qa_drive.js A "?autoplay=1" 12
 */
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SHELL =
  '/usr/local/google/home/mohansridharan/.gemini/jetski/scratch/tools/chrome-headless-shell-linux64/chrome-headless-shell';

/**
 * Sleeps for the specified duration in milliseconds.
 * @param {number} durationMs
 * @return {!Promise<void>}
 */
function sleep(durationMs) {
  return new Promise(function (resolve) {
    setTimeout(resolve, durationMs);
  });
}

/**
 * Spawns chrome-headless-shell and resolves with the child process and debugging port.
 * @param {string} shellBin
 * @param {string} userDataDir
 * @return {!Promise<{child: !Object, port: number}>}
 */
function launchBrowser(shellBin, userDataDir) {
  return new Promise(function (resolve, reject) {
    const args = [
      '--no-sandbox',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--hide-scrollbars',
      '--window-size=800,450',
      '--remote-debugging-port=0',
      '--user-data-dir=' + userDataDir,
      'about:blank',
    ];

    const child = spawn(shellBin, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderrBuf = '';
    let settled = false;

    const startTimeout = setTimeout(function () {
      if (!settled) {
        settled = true;
        reject(new Error('Timed out waiting for DevTools listening port. stderr: ' + stderrBuf));
      }
    }, 8000);

    child.on('error', function (err) {
      if (!settled) {
        settled = true;
        clearTimeout(startTimeout);
        reject(err);
      }
    });

    child.stderr.on('data', function (chunk) {
      stderrBuf += String(chunk);
      const match = stderrBuf.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
      if (match && !settled) {
        settled = true;
        clearTimeout(startTimeout);
        resolve({
          child: child,
          port: parseInt(match[1], 10),
        });
      }
    });
  });
}

/**
 * Queries /json/list until a page target with webSocketDebuggerUrl is available.
 * @param {number} port
 * @return {!Promise<string>}
 */
async function findPageWsUrl(port) {
  const listUrl = 'http://127.0.0.1:' + String(port) + '/json/list';
  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      const response = await fetch(listUrl);
      if (response.ok) {
        const targets = await response.json();
        if (Array.isArray(targets)) {
          for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            if (target && target.type === 'page' && target.webSocketDebuggerUrl) {
              return target.webSocketDebuggerUrl;
            }
          }
        }
      }
    } catch (e) {
      // Retry briefly while HTTP endpoint warms up
    }
    await sleep(100);
  }
  throw new Error('Could not find page target on port ' + String(port));
}

/**
 * Connects to a CDP WebSocket endpoint and provides a command sender and event collector.
 * @param {string} wsUrl
 * @return {!Promise<{
 *   send: function(string, !Object=): !Promise<!Object>,
 *   close: function(): void,
 *   exceptions: !Array<string>,
 *   consoleIssues: !Array<string>
 * }>}
 */
function connectCdp(wsUrl) {
  return new Promise(function (resolve, reject) {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();
    const exceptions = [];
    const consoleIssues = [];

    ws.addEventListener('open', function () {
      resolve({
        send: function (method, params) {
          return new Promise(function (cmdResolve, cmdReject) {
            const cmdId = nextId++;
            pending.set(cmdId, { resolve: cmdResolve, reject: cmdReject });
            ws.send(
              JSON.stringify({
                id: cmdId,
                method: method,
                params: params || {},
              })
            );
          });
        },
        close: function () {
          try {
            ws.close();
          } catch (e) {
            // Ignore close errors
          }
        },
        exceptions: exceptions,
        consoleIssues: consoleIssues,
      });
    });

    ws.addEventListener('error', function (err) {
      reject(new Error('WebSocket error: ' + String(err && err.message ? err.message : err)));
    });

    ws.addEventListener('message', function (event) {
      let msg = null;
      try {
        msg = JSON.parse(String(event.data));
      } catch (e) {
        return;
      }
      if (msg.id && pending.has(msg.id)) {
        const entry = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) {
          entry.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          entry.resolve(msg.result || {});
        }
        return;
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const details = msg.params && msg.params.exceptionDetails;
        const text = details
          ? (details.text || '') +
            (details.exception && details.exception.description
              ? ' ' + details.exception.description
              : '')
          : JSON.stringify(msg.params);
        exceptions.push(text.trim());
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const callType = msg.params && msg.params.type;
        if (callType === 'error' || callType === 'warning') {
          const args = (msg.params && msg.params.args) || [];
          const rendered = args
            .map(function (arg) {
              return arg.value !== undefined ? String(arg.value) : arg.description || '';
            })
            .join(' ');
          consoleIssues.push('[' + callType + '] ' + rendered);
        }
      }
    });
  });
}

/**
 * Formats one telemetry poll snapshot into a compact single-line summary.
 * @param {number} elapsedSec
 * @param {?Object} payload
 * @return {string}
 */
function formatSnapshotLine(elapsedSec, payload) {
  const data = payload || {};
  const st = data.st || null;
  const screen = data.screen || 'none';
  if (!st) {
    return (
      't=' +
      String(elapsedSec) +
      's state=unready screen=' +
      screen +
      ' time=- lives=- score=- cashews=- power=- x=-'
    );
  }
  const timeStr = typeof st.time === 'number' ? st.time.toFixed(1) : '-';
  const posX =
    st.playerPos && typeof st.playerPos.x === 'number'
      ? st.playerPos.x.toFixed(2)
      : '-';
  return (
    't=' +
    String(elapsedSec) +
    's state=' +
    String(st.state) +
    ' screen=' +
    String(screen) +
    ' time=' +
    timeStr +
    ' lives=' +
    String(st.lives) +
    ' score=' +
    String(st.score) +
    ' cashews=' +
    String(st.cashews) +
    ' power=' +
    String(st.power) +
    ' x=' +
    posX
  );
}

/**
 * Main CLI entrypoint.
 * @return {!Promise<number>}
 */
async function runQaDrive() {
  const scenarioName = process.argv[2] || 'default';
  let query = process.argv[3] || '';
  const secondsRaw = parseFloat(process.argv[4] || '5');
  const seconds = Number.isFinite(secondsRaw) && secondsRaw > 0 ? Math.ceil(secondsRaw) : 5;

  if (!query.includes('lowfx=')) {
    if (!query) {
      query = '?lowfx=1';
    } else if (query.startsWith('?')) {
      query = query + '&lowfx=1';
    } else {
      query = '?' + query + '&lowfx=1';
    }
  }

  const shellBin = process.env.SHELL_BIN || DEFAULT_SHELL;
  const userDataDir = fs.mkdtempSync('/tmp/kudla-qa-');
  const screenshotPath = '/tmp/qa_' + scenarioName + '.png';
  const indexPath = path.resolve(__dirname, '..', 'index.html');
  const targetUrl = 'file://' + indexPath + query;
  process.stdout.write('[' + scenarioName + '] Navigating to: ' + targetUrl + '\n');

  let browserChild = null;
  let cdp = null;

  /**
   * Cleans up browser process and temporary user-data-dir.
   */
  function cleanup() {
    if (cdp) {
      cdp.close();
      cdp = null;
    }
    if (browserChild) {
      try {
        browserChild.kill('SIGKILL');
      } catch (e) {
        // Ignore already dead process
      }
      browserChild = null;
    }
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  process.on('exit', cleanup);
  process.on('SIGINT', function () {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', function () {
    cleanup();
    process.exit(143);
  });

  const hardWatchdog = setTimeout(function () {
    process.stderr.write('ERROR: qa_drive watchdog expired for ' + scenarioName + '\n');
    cleanup();
    process.exit(1);
  }, (seconds + 14) * 1000);

  try {
    const launched = await launchBrowser(shellBin, userDataDir);
    browserChild = launched.child;

    const wsUrl = await findPageWsUrl(launched.port);
    cdp = await connectCdp(wsUrl);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: targetUrl });

    const readyExpr =
      'Boolean(window.KUDLA && KUDLA.debug && KUDLA.debug.game)';
    for (let waitIdx = 0; waitIdx < 30; waitIdx++) {
      const readyRes = await cdp.send('Runtime.evaluate', {
        expression: readyExpr,
        returnByValue: true,
      });
      if (readyRes && readyRes.result && readyRes.result.value === true) {
        break;
      }
      await sleep(100);
    }

    const evalExpr =
      "JSON.stringify({st: window.KUDLA && KUDLA.debug && KUDLA.debug.game ? KUDLA.debug.game.getState() : null, screen: (document.querySelector('.screen.is-active') || {}).id || 'none'})";

    for (let elapsed = 1; elapsed <= seconds; elapsed++) {
      await sleep(1000);
      const evalRes = await cdp.send('Runtime.evaluate', {
        expression: evalExpr,
        returnByValue: true,
      });
      let parsed = null;
      if (evalRes && evalRes.result && typeof evalRes.result.value === 'string') {
        try {
          parsed = JSON.parse(evalRes.result.value);
        } catch (e) {
          parsed = null;
        }
      }
      process.stdout.write(
        '[' + scenarioName + '] ' + formatSnapshotLine(elapsed, parsed) + '\n'
      );
    }

    const shotRes = await cdp.send('Page.captureScreenshot', { format: 'png' });
    if (shotRes && shotRes.data) {
      fs.writeFileSync(screenshotPath, Buffer.from(shotRes.data, 'base64'));
    }

    if (cdp.consoleIssues.length > 0) {
      process.stdout.write(
        '[' + scenarioName + '] console issues: ' + JSON.stringify(cdp.consoleIssues) + '\n'
      );
    }
    if (cdp.exceptions.length > 0) {
      process.stderr.write(
        '[' + scenarioName + '] exceptions: ' + JSON.stringify(cdp.exceptions) + '\n'
      );
      clearTimeout(hardWatchdog);
      cleanup();
      return 1;
    }

    clearTimeout(hardWatchdog);
    cleanup();
    return 0;
  } catch (err) {
    process.stderr.write(
      '[' + scenarioName + '] fatal error: ' + String(err && err.stack ? err.stack : err) + '\n'
    );
    clearTimeout(hardWatchdog);
    cleanup();
    return 1;
  }
}

runQaDrive().then(function (code) {
  process.exit(code);
});
