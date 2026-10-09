/**
 * @fileoverview Super Kudla Express — Unified Input Controller.
 * Handles keyboard, pointer-lock mouse look, and gamepad input.
 * Module contract per DESIGN.md section 8.3.
 */
(function (root) {
  'use strict';
  const KUDLA = (root.KUDLA = root.KUDLA || {});

  /** @type {?HTMLCanvasElement} */
  let activeCanvas = null;

  /** @type {!Object<string, boolean>} */
  let heldKeys = Object.create(null);

  /** @type {!Array<!Function>} */
  const pointerLockCallbacks = [];

  // Edge triggers (cleared on poll)
  let jumpPressedEdge = false;
  let firePressedEdge = false;
  let cameraToggleEdge = false;
  let mutePressedEdge = false;
  let pausePressedEdge = false;
  let confirmPressedEdge = false;

  // Mouse look deltas (cleared on poll)
  let accumulatedMouseX = 0;
  let accumulatedMouseY = 0;

  /**
   * Internal tracking flag to ignore the click that requested pointer lock.
   */
  let lockingClickOccurred = false;

  /**
   * Gamepad previous button state cache for edge detection.
   * @type {!Array<boolean>}
   */
  let previousGamepadButtons = [];

  /** @type {number} */
  let previousPollTime = 0;

  /**
   * User input settings.
   */
  const userSettings = {
    sensitivity: 1.0,
    invertY: false
  };

  /**
   * Safely reads a string item from localStorage.
   * @param {string} key
   * @return {?string}
   */
  function safeStorageGet(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (err) {
      // Storage unavailable in sandboxed environments.
    }
    return null;
  }

  /**
   * Safely writes a string item to localStorage.
   * @param {string} key
   * @param {string} value
   */
  function safeStorageSet(key, value) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (err) {
      // Storage unavailable in sandboxed environments.
    }
  }

  /**
   * Loads persisted settings from localStorage.
   */
  function loadPersistedSettings() {
    const storageKeys = (KUDLA.Config && KUDLA.Config.STORAGE_KEYS) || {};
    const sensVal = safeStorageGet(storageKeys.SENSITIVITY || 'kudla.sensitivity');
    if (sensVal !== null) {
      const parsedSens = parseFloat(sensVal);
      if (Number.isFinite(parsedSens) && parsedSens >= 0.1 && parsedSens <= 5.0) {
        userSettings.sensitivity = parsedSens;
      }
    }
    const invertVal = safeStorageGet(storageKeys.INVERT_Y || 'kudla.invertY');
    if (invertVal !== null) {
      userSettings.invertY = invertVal === 'true';
    }
  }

  /**
   * Determines if the active document focus is inside an editable input.
   * @return {boolean}
   */
  function isFocusInControl() {
    if (typeof document === 'undefined' || !document.activeElement) {
      return false;
    }
    const tag = document.activeElement.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  /**
   * Keydown event listener.
   * @param {!KeyboardEvent} event
   */
  function handleKeyDown(event) {
    if (event.repeat) {
      return;
    }

    // Space and arrows prevent default page scrolling
    const code = event.code;
    if (code === 'Space' || code === 'ArrowUp' || code === 'ArrowDown' ||
        code === 'ArrowLeft' || code === 'ArrowRight') {
      if (event.preventDefault) {
        event.preventDefault();
      }
    }

    if (isFocusInControl()) {
      return;
    }

    heldKeys[code] = true;

    if (code === 'Space') {
      jumpPressedEdge = true;
    } else if (code === 'KeyF') {
      firePressedEdge = true;
    } else if (code === 'KeyV') {
      cameraToggleEdge = true;
    } else if (code === 'KeyM') {
      mutePressedEdge = true;
    } else if (code === 'Escape' || code === 'KeyP') {
      pausePressedEdge = true;
    } else if (code === 'Enter') {
      confirmPressedEdge = true;
    }
  }

  /**
   * Keyup event listener.
   * @param {!KeyboardEvent} event
   */
  function handleKeyUp(event) {
    delete heldKeys[event.code];
  }

  /**
   * Window blur listener: clears all held keys.
   */
  function handleWindowBlur() {
    heldKeys = Object.create(null);
    accumulatedMouseX = 0;
    accumulatedMouseY = 0;
  }

  /**
   * Mousemove listener: accumulates look delta while locked.
   * @param {!MouseEvent} event
   */
  function handleMouseMove(event) {
    if (typeof document !== 'undefined' && document.pointerLockElement === activeCanvas) {
      accumulatedMouseX += event.movementX || 0;
      accumulatedMouseY += event.movementY || 0;
    }
  }

  /**
   * Mousedown listener: fires chilli only when locked, never on locking click.
   * @param {!MouseEvent} event
   */
  function handleMouseDown(event) {
    if (event.button !== 0) {
      return;
    }
    const isLocked = typeof document !== 'undefined' && document.pointerLockElement === activeCanvas;
    if (!isLocked) {
      lockingClickOccurred = true;
      if (activeCanvas && activeCanvas.requestPointerLock) {
        activeCanvas.requestPointerLock();
      }
    } else {
      if (!lockingClickOccurred) {
        firePressedEdge = true;
      }
    }
  }

  /**
   * Mouseup listener.
   * @param {!MouseEvent} event
   */
  function handleMouseUp(event) {
    if (event.button === 0) {
      lockingClickOccurred = false;
    }
  }

  /**
   * Pointer lock change listener.
   */
  function handlePointerLockChange() {
    const isLocked = typeof document !== 'undefined' && document.pointerLockElement === activeCanvas;
    if (!isLocked) {
      lockingClickOccurred = false;
    }
    for (let index = 0; index < pointerLockCallbacks.length; index += 1) {
      pointerLockCallbacks[index](isLocked);
    }
  }

  /**
   * Polls gamepad axes and buttons.
   * @param {number} deltaTime
   * @return {!{moveX: number, moveY: number, lookX: number, lookY: number, run: boolean, jumpHeld: boolean}}
   */
  function sampleGamepad(deltaTime) {
    const result = {
      moveX: 0,
      moveY: 0,
      lookX: 0,
      lookY: 0,
      run: false,
      jumpHeld: false
    };

    if (typeof navigator === 'undefined' || !navigator.getGamepads) {
      return result;
    }

    const gamepads = navigator.getGamepads();
    if (!gamepads) {
      return result;
    }

    let activePad = null;
    for (let index = 0; index < gamepads.length; index += 1) {
      if (gamepads[index] && gamepads[index].connected) {
        activePad = gamepads[index];
        break;
      }
    }
    if (!activePad) {
      return result;
    }

    // Left stick movement with 0.18 deadzone
    const leftAxisX = activePad.axes[0] || 0;
    const leftAxisY = activePad.axes[1] || 0;
    if (Math.hypot(leftAxisX, leftAxisY) > 0.18) {
      result.moveX = leftAxisX;
      result.moveY = -leftAxisY; // Stick up is negative axis, forward is positive
    }

    // Right stick look with 0.18 deadzone
    const rightAxisX = activePad.axes[2] || 0;
    const rightAxisY = activePad.axes[3] || 0;
    if (Math.hypot(rightAxisX, rightAxisY) > 0.18) {
      // 2.6 rad/sec scaled by sensitivity
      const lookSpeed = 2.6 * userSettings.sensitivity * deltaTime;
      result.lookX = rightAxisX * lookSpeed;
      result.lookY = -rightAxisY * lookSpeed * (userSettings.invertY ? -1 : 1);
    }

    // Buttons
    const buttons = activePad.buttons || [];
    const getBtn = function (btnIndex) {
      return Boolean(buttons[btnIndex] && buttons[btnIndex].pressed);
    };

    const btnA = getBtn(0); // Jump / Confirm
    const btnB = getBtn(1); // Fire chilli
    const btnX = getBtn(2); // Run
    const btnY = getBtn(3); // Camera
    const btnStart = getBtn(9); // Pause

    result.jumpHeld = btnA;
    result.run = btnX;

    // Edge triggers
    if (btnA && !previousGamepadButtons[0]) {
      jumpPressedEdge = true;
      confirmPressedEdge = true;
    }
    if (btnB && !previousGamepadButtons[1]) {
      firePressedEdge = true;
    }
    if (btnY && !previousGamepadButtons[3]) {
      cameraToggleEdge = true;
    }
    if (btnStart && !previousGamepadButtons[9]) {
      pausePressedEdge = true;
    }

    previousGamepadButtons = [btnA, btnB, btnX, btnY, false, false, false, false, false, btnStart];
    return result;
  }

  const Input = {
    /**
     * Initializes input listeners on the given canvas and window.
     * @param {!HTMLCanvasElement} canvas
     */
    init: function (canvas) {
      activeCanvas = canvas;
      loadPersistedSettings();

      if (typeof window === 'undefined') {
        return;
      }

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('blur', handleWindowBlur);

      if (canvas) {
        canvas.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('mousemove', handleMouseMove);
      }

      if (typeof document !== 'undefined') {
        document.addEventListener('pointerlockchange', handlePointerLockChange);
      }
    },

    /**
     * Polls the current input state, returns look angles and actions, and resets edges.
     * @return {!{
     *   moveForward: number,
     *   moveRight: number,
     *   run: boolean,
     *   jumpPressed: boolean,
     *   jumpHeld: boolean,
     *   firePressed: boolean,
     *   cameraToggle: boolean,
     *   mutePressed: boolean,
     *   pausePressed: boolean,
     *   confirmPressed: boolean,
     *   lookX: number,
     *   lookY: number
     * }}
     */
    poll: function () {
      const now = (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now();
      const deltaTime = previousPollTime ? Math.min(0.05, (now - previousPollTime) / 1000) : 0.016;
      previousPollTime = now;

      // Keyboard movement
      let forward = 0;
      let right = 0;
      if (heldKeys['KeyW'] || heldKeys['ArrowUp']) {
        forward += 1;
      }
      if (heldKeys['KeyS'] || heldKeys['ArrowDown']) {
        forward -= 1;
      }
      if (heldKeys['KeyD'] || heldKeys['ArrowRight']) {
        right += 1;
      }
      if (heldKeys['KeyA'] || heldKeys['ArrowLeft']) {
        right -= 1;
      }

      const runHeld = Boolean(heldKeys['ShiftLeft'] || heldKeys['ShiftRight']);
      const spaceHeld = Boolean(heldKeys['Space']);

      // Sample Gamepad
      const padState = sampleGamepad(deltaTime);

      forward += padState.moveY;
      right += padState.moveX;

      const clampedForward = Math.max(-1, Math.min(1, forward));
      const clampedRight = Math.max(-1, Math.min(1, right));
      const combinedRun = runHeld || padState.run;
      const combinedJumpHeld = spaceHeld || padState.jumpHeld;

      // Mouse look calculations
      const baseSensitivity = (KUDLA.Config && KUDLA.Config.CAMERA)
        ? KUDLA.Config.CAMERA.MOUSE_SENSITIVITY
        : 0.0022;
      const effectiveSens = baseSensitivity * userSettings.sensitivity;

      let lookX = (accumulatedMouseX * effectiveSens) + padState.lookX;
      // Moving mouse up has negative movementY; positive lookY looks up
      let lookY = (-accumulatedMouseY * effectiveSens * (userSettings.invertY ? -1 : 1)) + padState.lookY;

      // Reset accumulators
      accumulatedMouseX = 0;
      accumulatedMouseY = 0;

      // Snapshot edges
      const snapshot = {
        moveForward: clampedForward,
        moveRight: clampedRight,
        run: combinedRun,
        jumpPressed: jumpPressedEdge,
        jumpHeld: combinedJumpHeld,
        firePressed: firePressedEdge,
        cameraToggle: cameraToggleEdge,
        mutePressed: mutePressedEdge,
        pausePressed: pausePressedEdge,
        confirmPressed: confirmPressedEdge,
        lookX: lookX,
        lookY: lookY
      };

      // Reset edge flags
      jumpPressedEdge = false;
      firePressedEdge = false;
      cameraToggleEdge = false;
      mutePressedEdge = false;
      pausePressedEdge = false;
      confirmPressedEdge = false;

      return snapshot;
    },

    /**
     * Requests pointer lock on the active game canvas.
     */
    requestPointerLock: function () {
      if (activeCanvas && activeCanvas.requestPointerLock) {
        activeCanvas.requestPointerLock();
      }
    },

    /**
     * Exits pointer lock.
     */
    exitPointerLock: function () {
      if (typeof document !== 'undefined' && document.exitPointerLock) {
        document.exitPointerLock();
      }
    },

    /**
     * Returns true if the pointer is currently locked.
     * @return {boolean}
     */
    isPointerLocked: function () {
      return typeof document !== 'undefined' && document.pointerLockElement === activeCanvas;
    },

    /**
     * Registers a callback for pointer lock state changes.
     * @param {!Function} callback
     */
    onPointerLockChange: function (callback) {
      if (typeof callback === 'function') {
        pointerLockCallbacks.push(callback);
      }
    },

    /**
     * Sets mouse sensitivity multiplier and persists it.
     * @param {number} multiplier
     */
    setSensitivity: function (multiplier) {
      if (typeof multiplier === 'number' && Number.isFinite(multiplier) && multiplier > 0) {
        userSettings.sensitivity = multiplier;
        const storageKeys = (KUDLA.Config && KUDLA.Config.STORAGE_KEYS) || {};
        safeStorageSet(storageKeys.SENSITIVITY || 'kudla.sensitivity', String(multiplier));
      }
    },

    /**
     * Sets invert pitch (Y-axis) setting and persists it.
     * @param {boolean} bool
     */
    setInvertY: function (bool) {
      userSettings.invertY = Boolean(bool);
      const storageKeys = (KUDLA.Config && KUDLA.Config.STORAGE_KEYS) || {};
      safeStorageSet(storageKeys.INVERT_Y || 'kudla.invertY', String(userSettings.invertY));
    },

    /**
     * Returns a defensive copy of user settings.
     * @return {!{sensitivity: number, invertY: boolean}}
     */
    getSettings: function () {
      return {
        sensitivity: userSettings.sensitivity,
        invertY: userSettings.invertY
      };
    }
  };

  KUDLA.Input = Input;
  if (typeof module === 'object' && module.exports) {
    module.exports = Input;
  }
})(typeof window !== 'undefined' ? window : globalThis);
