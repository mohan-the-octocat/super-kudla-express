/**
 * @fileoverview Super Kudla Express: browser bootstrap and main loop.
 * Coordinates font readiness, Three.js WebGLRenderer setup, static Scenery.build,
 * HUD/Input/Audio wiring, URL hooks (?x=, ?autoplay=1, ?cam=third), and the
 * fixed-timestep animation loop per DESIGN.md §9.
 */
(function (root) {
  'use strict';
  const KUDLA = (root.KUDLA = root.KUDLA || {});

  /**
   * Safely reads a string value from localStorage.
   * @param {string} key
   * @return {?string}
   */
  function safeStorageGet(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      // Ignore storage access errors in restricted contexts
    }
    return null;
  }

  /**
   * Safely writes a string value to localStorage.
   * @param {string} key
   * @param {string} value
   */
  function safeStorageSet(key, value) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      // Ignore storage access errors in restricted contexts
    }
  }

  /**
   * Awaits document.fonts.ready with a 1500 ms cap so canvas textures render
   * with Kannada, Devanagari, and Latin fonts when available.
   * @return {!Promise<void>}
   */
  function waitForFonts() {
    if (
      typeof document === 'undefined' ||
      !document.fonts ||
      !document.fonts.ready
    ) {
      return Promise.resolve();
    }
    const timeoutPromise = new Promise(function (resolve) {
      setTimeout(resolve, 1500);
    });
    return Promise.race([document.fonts.ready, timeoutPromise]).then(function () {});
  }

  /**
   * Parses URL search parameters for debug, QA, and autoplay hooks.
   * Parsed once at boot, ignored when invalid per specification.
   * @return {!{
   *   spawnX: ?number,
   *   autoplay: boolean,
   *   autostart: boolean,
   *   cameraMode: ?string,
   *   yaw: ?number,
   *   pitch: ?number,
   *   lives: ?number,
   *   lowfx: boolean
   * }}
   */
  function parseUrlHooks() {
    const result = {
      spawnX: null,
      autoplay: false,
      autostart: false,
      cameraMode: null,
      yaw: null,
      pitch: null,
      lives: null,
      lowfx: false,
    };
    if (typeof window === 'undefined' || !window.location) {
      return result;
    }
    try {
      const params = new URLSearchParams(window.location.search || '');
      if (params.has('x')) {
        const parsedX = parseFloat(params.get('x'));
        if (Number.isFinite(parsedX)) {
          result.spawnX = parsedX;
        }
      }
      const autoVal = params.get('autoplay');
      if (autoVal === '1' || autoVal === 'true') {
        result.autoplay = true;
      }
      const startVal = params.get('autostart');
      if (startVal === '1' || startVal === 'true') {
        result.autostart = true;
      }
      const lowfxVal = params.get('lowfx');
      if (lowfxVal === '1' || lowfxVal === 'true') {
        result.lowfx = true;
      }
      const camVal = params.get('cam');
      if (camVal === 'third' || camVal === 'first') {
        result.cameraMode = camVal;
      }
      if (params.has('yaw')) {
        const parsedYaw = parseFloat(params.get('yaw'));
        if (Number.isFinite(parsedYaw)) {
          result.yaw = parsedYaw * (Math.PI / 180);
        }
      }
      if (params.has('pitch')) {
        const parsedPitch = parseFloat(params.get('pitch'));
        const Config = KUDLA.Config;
        const pitchLimit =
          Config && Config.CAMERA ? Config.CAMERA.PITCH_LIMIT : 1.45;
        const pitchLimitDeg = pitchLimit * (180 / Math.PI);
        if (
          Number.isFinite(parsedPitch) &&
          Math.abs(parsedPitch) <= pitchLimitDeg
        ) {
          result.pitch = parsedPitch * (Math.PI / 180);
        }
      }
      if (params.has('lives')) {
        const livesRaw = params.get('lives');
        if (livesRaw && /^[1-9]$/.test(livesRaw.trim())) {
          result.lives = parseInt(livesRaw.trim(), 10);
        }
      }
    } catch (e) {
      // Fallback to defaults if URLSearchParams fails
    }
    return result;
  }

  /**
   * Boots the browser game.
   * @return {!Promise<void>}
   */
  async function boot() {
    if (typeof document === 'undefined') {
      return;
    }
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
      return;
    }

    const Config = KUDLA.Config;
    const HUD = KUDLA.HUD;
    const Input = KUDLA.Input;
    const Audio = KUDLA.Audio;
    const THREE = root.THREE;

    if (HUD) {
      HUD.setLoadingProgress(0.15, 'Loading Mangaluru station fonts...');
    }

    await waitForFonts();

    if (HUD) {
      HUD.setLoadingProgress(0.35, 'Initializing WebGL renderer...');
      HUD.init();
    }

    const urlHooks = parseUrlHooks();

    let renderer = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: !urlHooks.lowfx,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(
        urlHooks.lowfx ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)
      );
      renderer.setSize(window.innerWidth || 1280, window.innerHeight || 720);
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.shadowMap.enabled = true;
      if (urlHooks.lowfx) {
        renderer.shadowMap.type = THREE.BasicShadowMap;
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = true;
      } else {
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.shadowMap.autoUpdate = true;
      }
    } catch (e) {
      if (HUD) {
        HUD.showScreen('loading');
        HUD.setLoadingProgress(
          0,
          'WebGL is unavailable in this browser. Please enable hardware acceleration to play Super Kudla Express.'
        );
      }
      return;
    }

    const scene = new THREE.Scene();
    const aspect =
      (window.innerWidth || 1280) / Math.max(1, window.innerHeight || 720);
    const camera = new THREE.PerspectiveCamera(
      Config.CAMERA.FOV,
      aspect,
      Config.CAMERA.NEAR,
      Config.CAMERA.FAR
    );
    camera.rotation.order = 'YXZ';

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', function () {
        const width = window.innerWidth || 1280;
        const height = Math.max(1, window.innerHeight || 720);
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      });
    }

    if (HUD) {
      HUD.setLoadingProgress(0.65, 'Building Platform 1 & Matsyagandha Express...');
    }

    const initialLevel = KUDLA.Level.create();
    const scenery =
      KUDLA.Scenery && typeof KUDLA.Scenery.build === 'function'
        ? KUDLA.Scenery.build(scene, initialLevel)
        : null;

    if (Input) {
      Input.init(canvas);
    }

    const storageKeys = Config.STORAGE_KEYS;
    const savedBestRaw = safeStorageGet(storageKeys.BEST);
    const savedBest = savedBestRaw ? parseInt(savedBestRaw, 10) || 0 : 0;
    const savedCam = safeStorageGet(storageKeys.CAMERA);
    const initialCameraMode =
      urlHooks.cameraMode || (savedCam === 'third' ? 'third' : 'first');

    const game = new KUDLA.Game({
      scene: scene,
      level: initialLevel,
      scenery: scenery,
      audio: Audio,
      hud: HUD,
      options: {
        spawnX: urlHooks.spawnX,
        autoplay: urlHooks.autoplay,
        cameraMode: initialCameraMode,
        bestScore: savedBest,
        yaw: urlHooks.yaw,
        pitch: urlHooks.pitch,
        lives: urlHooks.lives,
        onBestScore: function (newBest) {
          safeStorageSet(storageKeys.BEST, String(Math.floor(newBest)));
        },
      },
    });

    KUDLA.debug = {
      game: game,
      renderer: renderer,
      scene: scene,
    };

    if (HUD) {
      HUD.on('start', function () {
        if (Audio) Audio.init();
        if (Input && !urlHooks.autoplay && !urlHooks.autostart) Input.requestPointerLock();
        game.start();
      });

      HUD.on('resume', function () {
        if (Audio) Audio.init();
        if (Input && !urlHooks.autoplay && !urlHooks.autostart) Input.requestPointerLock();
        game.resume();
      });

      HUD.on('restart', function () {
        if (Audio) Audio.init();
        if (Input && !urlHooks.autoplay && !urlHooks.autostart) Input.requestPointerLock();
        game.restart();
      });

      HUD.on('sensitivity', function (val) {
        if (Input) Input.setSensitivity(val);
      });

      HUD.on('invert', function (val) {
        if (Input) Input.setInvertY(val);
      });

      HUD.on('mute', function (val) {
        if (Audio) {
          Audio.init();
          Audio.setMuted(val);
        }
      });

      HUD.on('camera', function (mode) {
        game.setCameraMode(mode);
        safeStorageSet(storageKeys.CAMERA, mode);
      });
    }

    if (Input) {
      Input.onPointerLockChange(function (isLocked) {
        if (!isLocked && !urlHooks.autoplay && !urlHooks.autostart && game.getState().state === 'playing') {
          game.pause();
        }
      });
    }

    if (HUD) {
      HUD.setLoadingProgress(1.0, 'Ready for departure!');
    }

    if (urlHooks.autoplay || urlHooks.autostart) {
      game.start();
    } else if (HUD) {
      HUD.showScreen('title', { best: game.bestScore });
    }

    let prevTimestamp =
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    let lastShadowX = -9999;

    function frame(timestamp) {
      const now =
        typeof timestamp === 'number'
          ? timestamp
          : typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
      const rawDt = Math.max(0, (now - prevTimestamp) / 1000);
      prevTimestamp = now;
      const clampedDt = Math.min(rawDt, Config.MAX_FRAME_DT);

      const polled = Input ? Input.poll() : {};

      if (polled.cameraToggle) {
        const nextMode = game.cameraMode === 'first' ? 'third' : 'first';
        safeStorageSet(storageKeys.CAMERA, nextMode);
      }

      if (polled.pausePressed && game.getState().state === 'playing') {
        if (Input && !urlHooks.autoplay && !urlHooks.autostart) {
          Input.exitPointerLock();
        }
      }

      game.step(clampedDt, polled);

      const camState = game.getCameraState();
      camera.position.set(camState.eye.x, camState.eye.y, camState.eye.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = -(camState.yaw + Math.PI / 2);
      camera.rotation.x = camState.pitch;
      camera.rotation.z = camState.roll || 0;
      if (Math.abs(camera.fov - camState.fov) > 0.05) {
        camera.fov = camState.fov;
        camera.updateProjectionMatrix();
      }

      const telemetry = game.getState();
      if (scenery && scenery.sun) {
        const pPos = telemetry.playerPos;
        if (!urlHooks.lowfx) {
          scenery.sun.position.set(pPos.x - 30, pPos.y + 50, pPos.z + 25);
          if (scenery.sun.target) {
            scenery.sun.target.position.set(pPos.x, pPos.y, pPos.z);
            if (scenery.sun.target.updateMatrixWorld) {
              scenery.sun.target.updateMatrixWorld();
            }
          }
        } else if (Math.abs(pPos.x - lastShadowX) >= 2.5) {
          lastShadowX = pPos.x;
          scenery.sun.position.set(pPos.x - 30, pPos.y + 50, pPos.z + 25);
          if (scenery.sun.target) {
            scenery.sun.target.position.set(pPos.x, pPos.y, pPos.z);
            if (scenery.sun.target.updateMatrixWorld) {
              scenery.sun.target.updateMatrixWorld();
            }
          }
          renderer.shadowMap.needsUpdate = true;
        }
      }

      if (HUD) {
        HUD.update(telemetry);
      }

      renderer.render(scene, camera);
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(frame);
      }
    }

    // Perform an initial synchronous step and render so screenshots have a valid frame immediately
    game.step(Config.FIXED_DT, {});
    const initCam = game.getCameraState();
    camera.position.set(initCam.eye.x, initCam.eye.y, initCam.eye.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = -(initCam.yaw + Math.PI / 2);
    camera.rotation.x = initCam.pitch;
    camera.rotation.z = initCam.roll || 0;
    if (HUD) {
      HUD.update(game.getState());
    }
    renderer.render(scene, camera);

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(frame);
    }
  }

  const Main = {
    boot: boot,
  };

  KUDLA.Main = Main;
  if (typeof module === 'object' && module.exports) {
    module.exports = Main;
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
