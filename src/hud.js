/**
 * @fileoverview Super Kudla Express — Heads-Up Display and Screen Manager.
 * Module contract per DESIGN.md section 8.2.
 */
(function (root) {
  'use strict';
  const KUDLA = (root.KUDLA = root.KUDLA || {});

  /**
   * Internal listeners registry by event name.
   * @type {!Object<string, !Array<!Function>>}
   */
  const listeners = Object.create(null);

  /**
   * Cached DOM elements by ID.
   * @type {!Object<string, ?HTMLElement>}
   */
  const elements = Object.create(null);

  /**
   * Cached previous values to avoid unnecessary DOM mutations.
   * @type {!Object<string, *>}
   */
  const lastState = Object.create(null);

  /**
   * Active toast queue (max 3).
   * @type {!Array<{text: string, variant: string}>}
   */
  const toastQueue = [];

  /** @type {?number} */
  let toastTimer = null;

  /** @type {?number} */
  let flashTimer = null;

  /** @type {string} */
  let currentScreen = 'loading';

  /**
   * Emit an event to all registered listeners.
   * @param {string} eventName
   * @param {*} payload
   */
  function emit(eventName, payload) {
    const list = listeners[eventName];
    if (list && list.length > 0) {
      for (let index = 0; index < list.length; index += 1) {
        list[index](payload);
      }
    }
  }

  /**
   * Safely query an element by ID without throwing.
   * @param {string} id
   * @return {?HTMLElement}
   */
  function getEl(id) {
    if (elements[id] !== undefined) {
      return elements[id];
    }
    const element = (typeof document !== 'undefined' && document.getElementById)
      ? document.getElementById(id)
      : null;
    elements[id] = element;
    return element;
  }

  /**
   * Populate legend icon slots using KUDLA.Textures.icon if available.
   */
  function populateLegendIcons() {
    const container = getEl('title-legend');
    if (!container || !KUDLA.Textures || typeof KUDLA.Textures.icon !== 'function') {
      return;
    }
    const slots = container.querySelectorAll('.legend-icon-slot');
    for (let index = 0; index < slots.length; index += 1) {
      const slot = slots[index];
      const iconName = slot.getAttribute('data-icon');
      if (!iconName) {
        continue;
      }
      try {
        const iconCanvas = KUDLA.Textures.icon(iconName);
        if (iconCanvas && iconCanvas.toDataURL) {
          const image = document.createElement('img');
          image.src = iconCanvas.toDataURL();
          image.alt = iconName;
          slot.textContent = '';
          slot.appendChild(image);
        }
      } catch (err) {
        // Fallback remains in place.
      }
    }
  }

  /**
   * Show the next toast from the queue if not currently displaying.
   */
  function processToastQueue() {
    if (toastTimer !== null || toastQueue.length === 0) {
      return;
    }
    const nextToast = toastQueue.shift();
    const toastElement = getEl('hud-toast');
    if (!toastElement) {
      return;
    }

    toastElement.textContent = nextToast.text;
    toastElement.className = 'hud-toast toast-' + nextToast.variant;
    toastElement.classList.remove('is-hidden');

    toastTimer = (typeof window !== 'undefined' && window.setTimeout)
      ? window.setTimeout(function () {
          toastElement.classList.add('is-hidden');
          toastTimer = null;
          // Process next toast after short transition.
          if (toastQueue.length > 0 && window.setTimeout) {
            window.setTimeout(processToastQueue, 150);
          }
        }, 2200)
      : null;
  }

  /**
   * Handle Enter key press on screens to trigger the primary screen action.
   * @param {!KeyboardEvent} event
   */
  function handleKeyDown(event) {
    if (event.key !== 'Enter') {
      return;
    }
    if (currentScreen === 'title') {
      emit('start');
    } else if (currentScreen === 'pause') {
      emit('resume');
    } else if (currentScreen === 'dead' || currentScreen === 'gameover' || currentScreen === 'clear') {
      emit('restart');
    }
  }

  const HUD = {
    /**
     * Initializes HUD references and binds UI controls and keys.
     */
    init: function () {
      // Pre-cache essential elements
      const idList = [
        'hud', 'hud-score', 'hud-cashews', 'hud-world', 'hud-time', 'hud-lives',
        'hud-power', 'hud-progress', 'hud-progress-fill', 'hud-progress-marker',
        'hud-toast', 'hud-crosshair', 'hud-flash', 'hud-camera', 'hud-mute',
        'screen-loading', 'screen-title', 'screen-pause', 'screen-dead',
        'screen-gameover', 'screen-clear', 'btn-start', 'title-best', 'title-legend',
        'btn-resume', 'btn-restart-pause', 'opt-sensitivity', 'opt-invert',
        'opt-mute', 'opt-camera-third', 'dead-message', 'dead-lives',
        'gameover-message', 'gameover-score', 'btn-restart-over', 'clear-score',
        'clear-time-bonus', 'clear-flag-bonus', 'clear-best', 'btn-restart-clear',
        'loading-bar', 'loading-label'
      ];
      for (let index = 0; index < idList.length; index += 1) {
        getEl(idList[index]);
      }

      // Populate title legend icons if textures are available
      populateLegendIcons();

      // Bind buttons
      const startBtn = getEl('btn-start');
      if (startBtn) {
        startBtn.addEventListener('click', function () { emit('start'); });
      }

      const resumeBtn = getEl('btn-resume');
      if (resumeBtn) {
        resumeBtn.addEventListener('click', function () { emit('resume'); });
      }

      const restartPauseBtn = getEl('btn-restart-pause');
      if (restartPauseBtn) {
        restartPauseBtn.addEventListener('click', function () { emit('restart'); });
      }

      const restartOverBtn = getEl('btn-restart-over');
      if (restartOverBtn) {
        restartOverBtn.addEventListener('click', function () { emit('restart'); });
      }

      const restartClearBtn = getEl('btn-restart-clear');
      if (restartClearBtn) {
        restartClearBtn.addEventListener('click', function () { emit('restart'); });
      }

      // Bind settings
      const sensInput = getEl('opt-sensitivity');
      if (sensInput) {
        sensInput.addEventListener('input', function (event) {
          const value = parseFloat(event.target.value);
          if (Number.isFinite(value)) {
            emit('sensitivity', value);
          }
        });
      }

      const invertInput = getEl('opt-invert');
      if (invertInput) {
        invertInput.addEventListener('change', function (event) {
          emit('invert', Boolean(event.target.checked));
        });
      }

      const muteInput = getEl('opt-mute');
      if (muteInput) {
        muteInput.addEventListener('change', function (event) {
          emit('mute', Boolean(event.target.checked));
        });
      }

      const cameraInput = getEl('opt-camera-third');
      if (cameraInput) {
        cameraInput.addEventListener('change', function (event) {
          emit('camera', event.target.checked ? 'third' : 'first');
        });
      }

      // Listen for Enter key globally
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('keydown', handleKeyDown);
      }
    },

    /**
     * Registers an event listener.
     * @param {string} eventName
     * @param {!Function} callback
     */
    on: function (eventName, callback) {
      if (typeof callback !== 'function') {
        return;
      }
      if (!listeners[eventName]) {
        listeners[eventName] = [];
      }
      listeners[eventName].push(callback);
    },

    /**
     * Updates HUD telemetry. Modifies the DOM only when values change.
     * @param {!Object} state
     */
    update: function (state) {
      if (!state || typeof state !== 'object') {
        return;
      }

      // Score (zero-padded to 6 digits)
      if (state.score !== undefined && state.score !== lastState.score) {
        lastState.score = state.score;
        const scoreEl = getEl('hud-score');
        if (scoreEl) {
          const scoreNum = Math.floor(Math.max(0, state.score));
          scoreEl.textContent = String(scoreNum).padStart(6, '0');
        }
      }

      // Cashews (zero-padded to 2 digits)
      if (state.cashews !== undefined && state.cashews !== lastState.cashews) {
        lastState.cashews = state.cashews;
        const cashewsEl = getEl('hud-cashews');
        if (cashewsEl) {
          const cashewNum = Math.floor(Math.max(0, state.cashews));
          cashewsEl.textContent = 'x' + String(cashewNum).padStart(2, '0');
        }
      }

      // Lives
      if (state.lives !== undefined && state.lives !== lastState.lives) {
        lastState.lives = state.lives;
        const livesEl = getEl('hud-lives');
        if (livesEl) {
          livesEl.textContent = 'x' + String(state.lives);
        }
      }

      // Time (integer seconds)
      if (state.time !== undefined && state.time !== lastState.time) {
        lastState.time = state.time;
        const timeEl = getEl('hud-time');
        if (timeEl) {
          const intTime = Math.max(0, Math.ceil(state.time));
          timeEl.textContent = String(intTime);
          const hurryThreshold = (KUDLA.Config && KUDLA.Config.HURRY_TIME) || 60;
          HUD.setHurry(intTime <= hurryThreshold);
        }
      }

      // Power state
      if (state.power !== lastState.power || state.starTime !== lastState.starTime) {
        lastState.power = state.power;
        lastState.starTime = state.starTime;
        const powerEl = getEl('hud-power');
        if (powerEl) {
          let powerLabel = String(state.power || 'small').toUpperCase();
          if (state.starTime && state.starTime > 0) {
            powerLabel = 'STAR';
          }
          powerEl.textContent = powerLabel;
        }
      }

      // Platform progress
      if (state.progress !== undefined && state.progress !== lastState.progress) {
        lastState.progress = state.progress;
        const fraction = Math.max(0, Math.min(1, state.progress));
        const pctString = (fraction * 100).toFixed(1) + '%';
        const fillEl = getEl('hud-progress-fill');
        if (fillEl) {
          fillEl.style.width = pctString;
        }
        const markerEl = getEl('hud-progress-marker');
        if (markerEl) {
          markerEl.style.left = pctString;
        }
      }

      // Camera indicator
      if (state.cameraMode !== undefined && state.cameraMode !== lastState.cameraMode) {
        lastState.cameraMode = state.cameraMode;
        const cameraEl = getEl('hud-camera');
        if (cameraEl) {
          cameraEl.textContent = state.cameraMode === 'third' ? '3RD' : '1ST';
        }
      }

      // Mute indicator
      if (state.muted !== undefined && state.muted !== lastState.muted) {
        lastState.muted = state.muted;
        const muteEl = getEl('hud-mute');
        if (muteEl) {
          muteEl.textContent = state.muted ? 'MUTED' : 'SOUND';
          muteEl.classList.toggle('is-muted', Boolean(state.muted));
        }
      }
    },

    /**
     * Enqueues a station-announcement toast ticker.
     * @param {string} text
     * @param {string=} variant 'info'|'power'|'warn'|'bonus'
     */
    toast: function (text, variant) {
      if (!text) {
        return;
      }
      if (toastQueue.length >= 3) {
        toastQueue.shift();
      }
      toastQueue.push({
        text: String(text),
        variant: variant || 'info'
      });
      processToastQueue();
    },

    /**
     * Displays a named screen or hides all screens during active gameplay.
     * @param {string} name 'loading'|'title'|'pause'|'dead'|'gameover'|'clear'|'none'
     * @param {Object=} data Screen-specific payload
     */
    showScreen: function (name, data) {
      currentScreen = name;
      const screenNames = ['loading', 'title', 'pause', 'dead', 'gameover', 'clear'];
      const hudElement = getEl('hud');

      if (name === 'none') {
        for (let index = 0; index < screenNames.length; index += 1) {
          const screen = getEl('screen-' + screenNames[index]);
          if (screen) {
            screen.classList.remove('is-active');
          }
        }
        if (hudElement) {
          hudElement.classList.remove('is-hidden');
        }
        return;
      }

      // Hide HUD when screens are open
      if (hudElement) {
        hudElement.classList.add('is-hidden');
      }

      for (let index = 0; index < screenNames.length; index += 1) {
        const screen = getEl('screen-' + screenNames[index]);
        if (screen) {
          if (screenNames[index] === name) {
            screen.classList.add('is-active');
          } else {
            screen.classList.remove('is-active');
          }
        }
      }

      // Populate screen data
      const screenData = data || {};
      if (name === 'title') {
        populateLegendIcons();
        if (screenData.best !== undefined) {
          const bestEl = getEl('title-best');
          if (bestEl) {
            const bestNum = Math.floor(Math.max(0, screenData.best));
            bestEl.textContent = 'BEST SCORE: ' + String(bestNum).padStart(6, '0');
          }
        }
      } else if (name === 'pause') {
        const settings = screenData.settings || {};
        if (settings.sensitivity !== undefined) {
          const optSens = getEl('opt-sensitivity');
          if (optSens) {
            optSens.value = String(settings.sensitivity);
          }
        }
        if (settings.invertY !== undefined) {
          const optInv = getEl('opt-invert');
          if (optInv) {
            optInv.checked = Boolean(settings.invertY);
          }
        }
        if (settings.muted !== undefined) {
          const optMute = getEl('opt-mute');
          if (optMute) {
            optMute.checked = Boolean(settings.muted);
          }
        }
        if (settings.cameraMode !== undefined) {
          const optCam = getEl('opt-camera-third');
          if (optCam) {
            optCam.checked = settings.cameraMode === 'third';
          }
        }
      } else if (name === 'dead') {
        if (screenData.message) {
          const deadMsg = getEl('dead-message');
          if (deadMsg) {
            deadMsg.textContent = screenData.message;
          }
        }
        if (screenData.lives !== undefined) {
          const deadLives = getEl('dead-lives');
          if (deadLives) {
            deadLives.textContent = 'Lives left: ' + screenData.lives;
          }
        }
      } else if (name === 'gameover') {
        if (screenData.message) {
          const goMsg = getEl('gameover-message');
          if (goMsg) {
            goMsg.textContent = screenData.message;
          }
        }
        if (screenData.score !== undefined) {
          const goScore = getEl('gameover-score');
          if (goScore) {
            const scoreNum = Math.floor(Math.max(0, screenData.score));
            goScore.textContent = 'FINAL SCORE: ' + String(scoreNum).padStart(6, '0');
          }
        }
      } else if (name === 'clear') {
        if (screenData.score !== undefined) {
          const clrScore = getEl('clear-score');
          if (clrScore) {
            const scoreNum = Math.floor(Math.max(0, screenData.score));
            clrScore.textContent = String(scoreNum).padStart(6, '0');
          }
        }
        if (screenData.timeBonus !== undefined) {
          const clrTime = getEl('clear-time-bonus');
          if (clrTime) {
            clrTime.textContent = String(Math.floor(screenData.timeBonus));
          }
        }
        if (screenData.flagBonus !== undefined) {
          const clrFlag = getEl('clear-flag-bonus');
          if (clrFlag) {
            clrFlag.textContent = String(Math.floor(screenData.flagBonus));
          }
        }
        if (screenData.best !== undefined) {
          const clrBest = getEl('clear-best');
          if (clrBest) {
            const bestNum = Math.floor(Math.max(0, screenData.best));
            const prefix = screenData.newBest ? 'NEW RECORD: ' : 'RECORD SCORE: ';
            clrBest.textContent = prefix + String(bestNum).padStart(6, '0');
          }
        }
      }
    },

    /**
     * Toggles urgent hurry styling on the timer.
     * @param {boolean} active
     */
    setHurry: function (active) {
      const timeElement = getEl('hud-time');
      if (timeElement) {
        timeElement.classList.toggle('is-hurry', Boolean(active));
      }
    },

    /**
     * Triggers a screen flash vignette.
     * @param {string} kind 'hurt'|'power'|'star'|'none'
     */
    flash: function (kind) {
      const flashElement = getEl('hud-flash');
      if (!flashElement) {
        return;
      }
      if (flashTimer !== null) {
        if (typeof window !== 'undefined' && window.clearTimeout) {
          window.clearTimeout(flashTimer);
        }
        flashTimer = null;
      }

      flashElement.className = 'hud-flash flash-' + kind;

      if (kind === 'hurt' || kind === 'power') {
        flashTimer = (typeof window !== 'undefined' && window.setTimeout)
          ? window.setTimeout(function () {
              flashElement.className = 'hud-flash flash-none';
              flashTimer = null;
            }, 300)
          : null;
      }
    },

    /**
     * Shows or hides the centred crosshair dot.
     * @param {boolean} visible
     */
    setCrosshairVisible: function (visible) {
      const crosshair = getEl('hud-crosshair');
      if (crosshair) {
        crosshair.classList.toggle('is-hidden', !visible);
      }
    },

    /**
     * Updates loading screen progress.
     * @param {number} fraction Progress between 0 and 1
     * @param {string=} label Optional status text
     */
    setLoadingProgress: function (fraction, label) {
      const clamped = Math.max(0, Math.min(1, fraction || 0));
      const bar = getEl('loading-bar');
      if (bar) {
        bar.style.width = (clamped * 100).toFixed(1) + '%';
      }
      if (label) {
        const labelEl = getEl('loading-label');
        if (labelEl) {
          labelEl.textContent = label;
        }
      }
    }
  };

  KUDLA.HUD = HUD;
  if (typeof module === 'object' && module.exports) {
    module.exports = HUD;
  }
})(typeof window !== 'undefined' ? window : globalThis);
