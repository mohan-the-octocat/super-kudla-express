/**
 * @fileoverview Super Kudla Express: core gameplay rules engine.
 * Implements player states, block bumps/breaks/dispensing, power-ups, enemies,
 * fireballs, checkpoints, timer/hurry, death/respawn, flagpole sequence,
 * score popups, and first/third-person camera per DESIGN.md §9 and §10.
 * Pure logic + Three.js scene graph; zero DOM or window access so it runs in Node.
 */
(function (root) {
  'use strict';
  const KUDLA = (root.KUDLA = root.KUDLA || {});

  const COPY = Object.freeze({
    ANNOUNCE_START:
      'Attention please. Train number one two six two zero, Matsyagandha Express to Lokmanya Tilak Terminus, will depart from platform number one in four minutes.',
    ANNOUNCE_HURRY:
      'Attention please. Train number one two six two zero, Matsyagandha Express, departs in one minute.',
    TOAST_BUNS: 'MANGALORE BUNS! You grew taller.',
    TOAST_GHEEROAST: 'GHEE ROAST! Press F or click to throw chillies.',
    TOAST_GADBAD: 'GADBAD! Invincible for 10 seconds.',
    TOAST_COCONUT: 'BONDA! 1-UP',
    TOAST_CASHEWS: '100 CASHEWS! 1-UP',
    TOAST_HURRY: 'ATTENTION PLEASE: Matsyagandha Express departs in 60 seconds!',
    TOAST_CHECKPOINT: 'CHECKPOINT — halfway down Platform 1',
    TOAST_HURT: 'AYYO!',
    DEAD_DEFAULT: 'AYYO!',
    DEAD_TIMEUP: 'TIME UP! The train left without you.',
    GAMEOVER_MSG: 'MISSED THE TRAIN! Better catch a private bus from Hampankatta.',
    CLEAR_MSG: 'BOARDED! You caught the Matsyagandha Express.',
  });

  /**
   * Creates a safe audio wrapper falling back to no-ops for missing methods.
   * @param {?Object} rawAudio
   * @return {!Object}
   */
  function wrapAudio(rawAudio) {
    const src = rawAudio || {};
    let mutedFallback = false;
    return {
      init: function () {
        if (typeof src.init === 'function') src.init();
      },
      play: function (name) {
        if (typeof src.play === 'function') src.play(name);
      },
      startMusic: function (mode) {
        if (typeof src.startMusic === 'function') src.startMusic(mode);
      },
      stopMusic: function () {
        if (typeof src.stopMusic === 'function') src.stopMusic();
      },
      setMuted: function (bool) {
        mutedFallback = Boolean(bool);
        if (typeof src.setMuted === 'function') src.setMuted(bool);
      },
      isMuted: function () {
        return typeof src.isMuted === 'function' ? Boolean(src.isMuted()) : mutedFallback;
      },
      toggleMute: function () {
        if (typeof src.toggleMute === 'function') return Boolean(src.toggleMute());
        mutedFallback = !mutedFallback;
        return mutedFallback;
      },
      announce: function (text) {
        if (typeof src.announce === 'function') src.announce(text);
      },
      setRumble: function (intensity) {
        if (typeof src.setRumble === 'function') src.setRumble(intensity);
      },
    };
  }

  /**
   * Creates a safe HUD wrapper falling back to no-ops for missing methods.
   * @param {?Object} rawHud
   * @return {!Object}
   */
  function wrapHud(rawHud) {
    const src = rawHud || {};
    return {
      init: function () {
        if (typeof src.init === 'function') src.init();
      },
      on: function (eventName, callback) {
        if (typeof src.on === 'function') src.on(eventName, callback);
      },
      update: function (state) {
        if (typeof src.update === 'function') src.update(state);
      },
      toast: function (text, variant) {
        if (typeof src.toast === 'function') src.toast(text, variant);
      },
      showScreen: function (name, data) {
        if (typeof src.showScreen === 'function') src.showScreen(name, data);
      },
      setHurry: function (active) {
        if (typeof src.setHurry === 'function') src.setHurry(active);
      },
      flash: function (kind) {
        if (typeof src.flash === 'function') src.flash(kind);
      },
      setCrosshairVisible: function (visible) {
        if (typeof src.setCrosshairVisible === 'function') src.setCrosshairVisible(visible);
      },
      setLoadingProgress: function (fraction, label) {
        if (typeof src.setLoadingProgress === 'function') src.setLoadingProgress(fraction, label);
      },
    };
  }

  /**
   * Allocation-free slab ray-vs-AABB intersection test for a 3D segment
   * P(t) = (px, py, pz) + t * (dx, dy, dz), t in [0, 1].
   * @param {number} px Segment start X.
   * @param {number} py Segment start Y.
   * @param {number} pz Segment start Z.
   * @param {number} dx Segment delta X.
   * @param {number} dy Segment delta Y.
   * @param {number} dz Segment delta Z.
   * @param {!{minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number}} aabb
   * @return {number} Entry fraction t in [0, 1], or -1 if no hit.
   */
  function intersectSegmentAABB(px, py, pz, dx, dy, dz, aabb) {
    let tMin = 0;
    let tMax = 1;

    if (Math.abs(dx) < 1e-9) {
      if (px < aabb.minX || px > aabb.maxX) {
        return -1;
      }
    } else {
      const invDx = 1 / dx;
      let t1 = (aabb.minX - px) * invDx;
      let t2 = (aabb.maxX - px) * invDx;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > tMin) tMin = t1;
      if (t2 < tMax) tMax = t2;
      if (tMin > tMax) return -1;
    }

    if (Math.abs(dy) < 1e-9) {
      if (py < aabb.minY || py > aabb.maxY) {
        return -1;
      }
    } else {
      const invDy = 1 / dy;
      let t1 = (aabb.minY - py) * invDy;
      let t2 = (aabb.maxY - py) * invDy;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > tMin) tMin = t1;
      if (t2 < tMax) tMax = t2;
      if (tMin > tMax) return -1;
    }

    if (Math.abs(dz) < 1e-9) {
      if (pz < aabb.minZ || pz > aabb.maxZ) {
        return -1;
      }
    } else {
      const invDz = 1 / dz;
      let t1 = (aabb.minZ - pz) * invDz;
      let t2 = (aabb.maxZ - pz) * invDz;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > tMin) tMin = t1;
      if (t2 < tMax) tMax = t2;
      if (tMin > tMax) return -1;
    }

    return tMin;
  }

  /**
   * Main game rules engine.
   */
  class Game {
    /**
     * @param {!Object=} params Configuration object `{scene, level, scenery, audio, hud, options}`.
     */
    constructor(params) {
      const initParams = params || {};
      const THREE = root.THREE;
      const Config = KUDLA.Config;

      this.scene = initParams.scene || (THREE ? new THREE.Scene() : null);
      this.scenery = initParams.scenery || null;
      this.audio = wrapAudio(initParams.audio);
      this.hud = wrapHud(initParams.hud);

      const opts = initParams.options || {};
      this.spawnOverrideX =
        typeof opts.spawnX === 'number' && Number.isFinite(opts.spawnX) ? opts.spawnX : null;
      this.initialSpawnPending = this.spawnOverrideX !== null;
      this.autoplay = Boolean(opts.autoplay);
      this.cameraMode = opts.cameraMode === 'third' ? 'third' : 'first';
      this.bestScore =
        typeof opts.bestScore === 'number' && Number.isFinite(opts.bestScore) ? opts.bestScore : 0;
      this.onBestScore = typeof opts.onBestScore === 'function' ? opts.onBestScore : null;
      this.initialYaw =
        typeof opts.yaw === 'number' && Number.isFinite(opts.yaw) ? opts.yaw : null;
      this.initialPitch =
        typeof opts.pitch === 'number' && Number.isFinite(opts.pitch) ? opts.pitch : null;
      this.initialLives =
        typeof opts.lives === 'number' &&
        Number.isInteger(opts.lives) &&
        opts.lives >= 1 &&
        opts.lives <= 9
          ? opts.lives
          : Config.START_LIVES;

      this.dynamicGroup = THREE ? new THREE.Group() : null;
      if (this.scene && this.dynamicGroup) {
        this.scene.add(this.dynamicGroup);
      }

      this.playerMesh = KUDLA.Models ? KUDLA.Models.createPlayer() : null;
      if (this.scene && this.playerMesh) {
        this.scene.add(this.playerMesh);
      }

      // Persistent run telemetry
      this.state = 'title';
      this.score = 0;
      this.cashews = 0;
      this.lives = this.initialLives;
      this.time = Config.LEVEL_TIME;
      this.power = 'small';
      this.starTime = 0;
      this.invulnTime = 0;
      this.growFlickerTime = 0;
      this.checkpointReached = false;
      this.hurryTriggered = false;
      this.firstAnnouncementDone = false;

      // Timing and fixed-step accumulator
      this.accumulator = 0;
      this.elapsedTime = 0;
      this.autoplayTimer = 0;

      // Camera kinematics
      this.yaw = this.initialYaw !== null ? this.initialYaw : 0;
      this.pitch = this.initialPitch !== null ? this.initialPitch : 0;
      this.fov = Config.CAMERA.FOV;
      this.bobPhase = 0;
      this.bobOffset = 0;
      this.landingDip = 0;
      this.cameraRoll = 0;
      this.deathSink = 0;
      this.currentRumble = 0;
      this.thirdPersonDist = Infinity;
      this.thirdPersonCamDt = 0;

      // Death / flag state timers
      this.deathTimer = 0;
      this.deadScreenTimer = 0;
      this.deadScreenShown = false;
      this.deathMessage = COPY.DEAD_DEFAULT;
      this.flagPhase = 'none';
      this.flagPhaseTimer = 0;
      this.flagBonus = 0;
      this.timeBonus = 0;
      this.remainingWholeSeconds = 0;
      this.initialRemainingSeconds = 0;
      this.tallyTickAccum = 0;
      this.lastTickSoundTime = 0;
      this.trainSpeed = 0;
      this.flagStartHeight = 9.5;

      if (
        this.scenery &&
        this.scenery.flagPole &&
        this.scenery.flagPole.userData &&
        this.scenery.flagPole.userData.flag
      ) {
        this.flagStartHeight = this.scenery.flagPole.userData.flag.position.y || 9.5;
      }

      // Stomp chain index
      this.stompChainIndex = 0;

      // Reusable arrays & objects to avoid per-step allocations
      this.staticColliders = [];
      this.solidBlockColliders = [];
      this.playerStepColliders = [];
      this.collidersDirty = true;

      this.blocks = [];
      this.cashewsList = [];
      this.items = [];
      this.enemies = [];
      this.fireballs = [];
      this.shards = [];
      this.cashewPops = [];
      this.popups = [];

      this.reusableMotionInput = {
        moveX: 0,
        moveZ: 0,
        run: false,
        jumpPressed: false,
        jumpHeld: false,
      };
      this.reusablePlayerPos = { x: 0, y: 0, z: 0 };
      this.reusableCameraEye = { x: 0, y: 0, z: 0 };
      this.reusableCameraState = {
        eye: this.reusableCameraEye,
        yaw: 0,
        pitch: 0,
        mode: 'first',
        fov: Config.CAMERA.FOV,
        roll: 0,
      };

      this.player = {
        x: 2,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        width: Config.PLAYER_WIDTH,
        height: Config.PLAYER_HEIGHT_SMALL,
        depth: Config.PLAYER_WIDTH,
        onGround: true,
        coyoteTimer: 0,
        jumpBufferTimer: 0,
        jumpCutUsed: false,
        jumping: false,
      };

      this.loadLevel(initParams.level || KUDLA.Level.create());

      const self = this;
      this.debug = {
        teleport: function (posX, posY, posZ) {
          self.player.x = posX;
          self.player.z = posZ !== undefined ? posZ : 0;
          if (posY !== undefined) {
            self.player.y = posY;
          } else {
            const floorY = KUDLA.Level.floorTopAt(self.level, posX, self.player.z);
            self.player.y = floorY !== null ? floorY : 0;
          }
          self.player.vx = 0;
          self.player.vy = 0;
          self.player.vz = 0;
          self.thirdPersonDist = Infinity;
          self.syncPlayerMesh();
        },
        setPower: function (newPower) {
          self.setPowerState(newPower);
        },
        entities: function () {
          return {
            blocks: self.blocks,
            cashews: self.cashewsList,
            items: self.items,
            enemies: self.enemies,
            fireballs: self.fireballs,
            shards: self.shards,
            popups: self.popups,
            player: self.player,
          };
        },
        forceTime: function (seconds) {
          self.time = Math.max(0, Number(seconds) || 0);
        },
      };
    }

    /**
     * Populates level entities and meshes from a Level descriptor.
     * @param {!Object} levelData
     */
    loadLevel(levelData) {
      const Config = KUDLA.Config;
      const Models = KUDLA.Models;
      const Physics = KUDLA.Physics;

      this.level = levelData;
      this.staticColliders = KUDLA.Level.staticColliders(this.level);

      // Clear previous dynamic meshes
      if (this.dynamicGroup) {
        while (this.dynamicGroup.children.length > 0) {
          this.dynamicGroup.remove(this.dynamicGroup.children[0]);
        }
      }

      this.blocks.length = 0;
      this.cashewsList.length = 0;
      this.items.length = 0;
      this.enemies.length = 0;
      this.fireballs.length = 0;
      this.shards.length = 0;
      this.cashewPops.length = 0;
      this.popups.length = 0;

      // Reset standing train and flagPole if present in scenery
      if (this.scenery) {
        if (this.scenery.standingTrain && this.level.train) {
          this.scenery.standingTrain.position.set(
            this.level.train.rearX,
            Config.GEOMETRY.RAIL_TOP_Y,
            this.level.train.z
          );
        }
        if (
          this.scenery.flagPole &&
          this.scenery.flagPole.userData &&
          this.scenery.flagPole.userData.flag
        ) {
          this.scenery.flagPole.userData.flag.position.y = this.flagStartHeight;
        }
      }

      // Build blocks
      for (let i = 0; i < this.level.blocks.length; i++) {
        const blk = this.level.blocks[i];
        const visualKind = blk.kind === 'hidden' ? 'used' : blk.kind;
        const mesh = Models ? Models.createBlock(visualKind) : null;
        const baseY = blk.y + Config.BLOCK / 2;
        if (mesh) {
          mesh.position.set(blk.x, baseY, blk.z);
          mesh.userData.baseY = baseY;
          mesh.visible = blk.kind !== 'hidden';
          if (this.dynamicGroup) {
            this.dynamicGroup.add(mesh);
          }
        }
        const blockEntity = {
          isBlock: true,
          id: blk.id,
          kind: blk.kind,
          contents: blk.contents,
          x: blk.x,
          y: blk.y,
          z: blk.z,
          broken: false,
          bumpTimer: 0,
          multiCount: 0,
          multiTimer: 0,
          mesh: mesh,
          aabb: Physics.makeAABB(
            blk.x,
            blk.y,
            blk.z,
            Config.BLOCK,
            Config.BLOCK,
            Config.BLOCK
          ),
        };
        this.blocks.push(blockEntity);
      }

      // Build free cashews
      for (let i = 0; i < this.level.cashews.length; i++) {
        const csh = this.level.cashews[i];
        const mesh = Models ? Models.createCashew() : null;
        if (mesh) {
          mesh.position.set(csh.x, csh.y, csh.z);
          if (this.dynamicGroup) {
            this.dynamicGroup.add(mesh);
          }
        }
        this.cashewsList.push({
          id: csh.id,
          x: csh.x,
          y: csh.y,
          z: csh.z,
          collected: false,
          mesh: mesh,
          aabb: Physics.makeAABB(
            csh.x,
            csh.y,
            csh.z,
            Config.CASHEW_SIZE,
            Config.CASHEW_SIZE,
            Config.CASHEW_SIZE
          ),
        });
      }

      // Build enemies
      for (let i = 0; i < this.level.enemies.length; i++) {
        const enm = this.level.enemies[i];
        const mesh = Models ? Models.createEnemy(enm.type) : null;
        if (mesh) {
          mesh.position.set(enm.x, enm.y, enm.z);
          if (this.dynamicGroup) {
            this.dynamicGroup.add(mesh);
          }
        }
        let sizeSpec = Config.CRAB_SIZE;
        let speed = Config.CRAB_SPEED;
        if (enm.type === 'crow') {
          sizeSpec = Config.CROW_SIZE;
          speed = Config.CROW_SPEED;
        } else if (enm.type === 'chimney_crow') {
          sizeSpec = Config.CHIMNEY_CROW_SIZE;
          speed = 0;
        }
        this.enemies.push({
          id: enm.id,
          type: enm.type,
          x: enm.x,
          y: enm.y,
          z: enm.z,
          vx: 0,
          vy: 0,
          vz: 0,
          width: sizeSpec.w,
          height: sizeSpec.h,
          depth: sizeSpec.d,
          dir: enm.dir || -1,
          speed: speed,
          onGround: enm.type === 'crab',
          activated: false,
          state: 'active',
          squashTimer: 0,
          deadTimer: 0,
          baseY: enm.y,
          topY: enm.y,
          hiddenY: enm.y - sizeSpec.h - 0.1,
          cycleTime: 0,
          hidden: false,
          phase: i * 1.1,
          chimneyId: enm.chimneyId || null,
          mesh: mesh,
        });
      }

      this.collidersDirty = true;
      this.rebuildBlockColliders();
      this.resetPlayerAtSpawn();
    }

    /**
     * Rebuilds the persistent solid + block collider list when blocks change.
     */
    rebuildBlockColliders() {
      this.solidBlockColliders.length = 0;
      for (let i = 0; i < this.staticColliders.length; i++) {
        this.solidBlockColliders.push(this.staticColliders[i]);
      }
      for (let i = 0; i < this.blocks.length; i++) {
        const blk = this.blocks[i];
        if (!blk.broken && blk.kind !== 'hidden') {
          this.solidBlockColliders.push({ aabb: blk.aabb, ref: blk });
        }
      }
      this.collidersDirty = false;
    }

    /**
     * Places the player at checkpoint or start position.
     */
    resetPlayerAtSpawn() {
      const start = this.level.playerStart;
      let spawnX = start.x;
      let spawnZ = start.z;
      if (this.checkpointReached) {
        spawnX = this.level.checkpoint.x;
        spawnZ = this.level.checkpoint.z;
      } else if (this.initialSpawnPending && this.spawnOverrideX !== null) {
        this.initialSpawnPending = false;
        spawnX = this.spawnOverrideX;
        spawnZ = 0;
      }
      const floorTop = KUDLA.Level.floorTopAt(this.level, spawnX, spawnZ);
      const spawnY = floorTop !== null ? floorTop : start.y;

      this.player.x = spawnX;
      this.player.y = spawnY;
      this.player.z = spawnZ;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.vz = 0;
      this.player.onGround = true;
      this.player.coyoteTimer = 0;
      this.player.jumpBufferTimer = 0;
      this.player.jumping = false;
      this.player.jumpCutUsed = false;

      this.yaw = this.initialYaw !== null ? this.initialYaw : (start.yaw || 0);
      this.pitch = this.initialPitch !== null ? this.initialPitch : 0;
      this.cameraRoll = 0;
      this.deathSink = 0;
      this.landingDip = 0;
      this.thirdPersonDist = Infinity;
      this.thirdPersonCamDt = 0;
      this.stompChainIndex = 0;

      this.setPowerState(this.power);
      this.syncPlayerMesh();
    }

    /**
     * Updates the player power state and physical height.
     * @param {string} newPower 'small' | 'big' | 'fire'
     */
    setPowerState(newPower) {
      const Config = KUDLA.Config;
      const validPower =
        newPower === 'big' || newPower === 'fire' ? newPower : 'small';
      this.power = validPower;
      this.player.height =
        validPower === 'small' ? Config.PLAYER_HEIGHT_SMALL : Config.PLAYER_HEIGHT_BIG;
      if (this.playerMesh && KUDLA.Models) {
        KUDLA.Models.setPlayerPower(this.playerMesh, validPower);
      }
    }

    /**
     * Sets camera mode ('first' or 'third') and updates avatar/crosshair visibility.
     * @param {string} mode 'first' | 'third'
     */
    setCameraMode(mode) {
      this.cameraMode = mode === 'third' ? 'third' : 'first';
      this.hud.setCrosshairVisible(this.cameraMode === 'first');
      this.syncPlayerMesh();
    }

    /**
     * Synchronizes the player avatar mesh position, rotation, and visibility.
     */
    syncPlayerMesh() {
      if (!this.playerMesh) {
        return;
      }
      this.playerMesh.position.set(this.player.x, this.player.y, this.player.z);
      const horizSpeed = Math.hypot(this.player.vx, this.player.vz);
      if (horizSpeed > 0.1) {
        this.playerMesh.rotation.y = Math.atan2(this.player.vx, this.player.vz);
      } else {
        this.playerMesh.rotation.y = Math.atan2(Math.cos(this.yaw), Math.sin(this.yaw));
      }

      if (KUDLA.Models) {
        let animState = 'idle';
        if (!this.player.onGround) {
          animState = 'jump';
        } else if (horizSpeed > 0.2) {
          animState = 'run';
        }
        KUDLA.Models.animate(this.playerMesh, this.elapsedTime, animState, horizSpeed);
      }

      const inFlagWalk =
        this.state === 'flag' && (this.flagPhase === 'slide' || this.flagPhase === 'walk');
      const boarded =
        (this.state === 'flag' && this.flagPhase === 'depart') || this.state === 'clear';
      let visible = (this.cameraMode === 'third' || inFlagWalk) && !boarded;
      if (visible && (this.invulnTime > 0 || this.growFlickerTime > 0)) {
        visible = Math.floor(this.elapsedTime * 20) % 2 === 0;
      }
      this.playerMesh.visible = visible;
    }

    /**
     * Starts or enters active gameplay.
     */
    start() {
      const Config = KUDLA.Config;
      this.state = 'playing';
      this.time = Config.LEVEL_TIME;
      this.hurryTriggered = false;
      this.cameraRoll = 0;
      this.deathSink = 0;
      this.hud.setHurry(false);
      this.hud.flash('none');
      this.hud.showScreen('none');
      this.hud.setCrosshairVisible(this.cameraMode === 'first');
      this.audio.startMusic('main');

      if (!this.firstAnnouncementDone) {
        this.firstAnnouncementDone = true;
        this.audio.announce(COPY.ANNOUNCE_START);
      }
      this.syncPlayerMesh();
    }

    /**
     * Pauses the game when playing.
     */
    pause() {
      if (this.state !== 'playing') {
        return;
      }
      this.state = 'paused';
      this.audio.play('pause');
      this.audio.stopMusic();
      this.audio.setRumble(0);
      const inputSettings =
        KUDLA.Input && typeof KUDLA.Input.getSettings === 'function'
          ? KUDLA.Input.getSettings()
          : { sensitivity: 1.0, invertY: false };
      this.hud.showScreen('pause', {
        settings: {
          sensitivity: inputSettings.sensitivity,
          invertY: inputSettings.invertY,
          muted: this.audio.isMuted(),
          cameraMode: this.cameraMode,
        },
      });
    }

    /**
     * Resumes the game from pause.
     */
    resume() {
      if (this.state !== 'paused') {
        return;
      }
      const Config = KUDLA.Config;
      this.state = 'playing';
      this.audio.play('pause');
      this.hud.showScreen('none');
      this.hud.setCrosshairVisible(this.cameraMode === 'first');
      if (this.starTime > 0) {
        this.audio.startMusic('star');
      } else if (this.time <= Config.HURRY_TIME) {
        this.audio.startMusic('hurry');
      } else {
        this.audio.startMusic('main');
      }
    }

    /**
     * Starts a completely fresh run (lives, score, cashews, power, level reset).
     */
    restart() {
      const Config = KUDLA.Config;
      this.score = 0;
      this.cashews = 0;
      this.lives = this.initialLives;
      this.power = 'small';
      this.starTime = 0;
      this.invulnTime = 0;
      this.growFlickerTime = 0;
      this.checkpointReached = false;
      this.hurryTriggered = false;
      this.time = Config.LEVEL_TIME;
      this.loadLevel(KUDLA.Level.create());
      this.start();
    }

    /**
     * Advances the game simulation by dt seconds using a fixed-timestep loop.
     * Calls scenery.update once per step(dt) invocation.
     * @param {number} dt Elapsed frame time in seconds.
     * @param {?Object} rawInput Input snapshot as returned by Input.poll().
     */
    step(dt, rawInput) {
      const Config = KUDLA.Config;
      const frameDt = Math.max(0, Math.min(Number(dt) || 0, Config.MAX_FRAME_DT));
      const input = rawInput || {};

      // Global toggles
      if (input.cameraToggle) {
        this.setCameraMode(this.cameraMode === 'first' ? 'third' : 'first');
      }
      if (input.mutePressed) {
        this.audio.toggleMute();
      }
      if (input.pausePressed) {
        if (this.state === 'playing') {
          this.pause();
          return;
        } else if (this.state === 'paused') {
          this.resume();
          return;
        }
      }

      // Apply look deltas when playing
      if (this.state === 'playing') {
        if (input.lookX) {
          this.yaw += input.lookX;
        }
        if (input.lookY) {
          this.pitch = Math.max(
            -Config.CAMERA.PITCH_LIMIT,
            Math.min(Config.CAMERA.PITCH_LIMIT, this.pitch + input.lookY)
          );
        }
      }

      this.elapsedTime += frameDt;
      this.thirdPersonCamDt += frameDt;

      // Update scenery once per rendered frame / step call
      if (this.scenery && typeof this.scenery.update === 'function') {
        this.reusablePlayerPos.x = this.player.x;
        this.reusablePlayerPos.y = this.player.y;
        this.reusablePlayerPos.z = this.player.z;
        const sceneryOut = this.scenery.update(
          frameDt,
          this.elapsedTime,
          this.reusablePlayerPos
        );
        if (sceneryOut) {
          if (sceneryOut.horn) {
            this.audio.play('horn');
          }
          this.currentRumble = sceneryOut.rumble || 0;
          if (this.state === 'playing') {
            this.audio.setRumble(this.currentRumble);
          }
        }
      }

      if (
        this.state === 'loading' ||
        this.state === 'title' ||
        this.state === 'paused' ||
        this.state === 'gameover' ||
        this.state === 'clear'
      ) {
        return;
      }

      this.accumulator += frameDt;
      let firstSubstep = true;
      const fixedDt = Config.FIXED_DT;

      while (this.accumulator + 1e-9 >= fixedDt) {
        this.accumulator -= fixedDt;
        if (this.accumulator < 1e-9) {
          this.accumulator = 0;
        }

        if (this.state === 'playing') {
          this.stepPlaying(fixedDt, input, firstSubstep);
        } else if (this.state === 'dying') {
          this.stepDying(fixedDt);
        } else if (this.state === 'flag') {
          this.stepFlag(fixedDt);
        }

        firstSubstep = false;
      }

      this.syncPlayerMesh();
    }

    /**
     * Executes one fixed substep during active gameplay.
     * @param {number} fixedDt
     * @param {!Object} input
     * @param {boolean} isFirstSubstep
     */
    stepPlaying(fixedDt, input, isFirstSubstep) {
      const Config = KUDLA.Config;
      const Physics = KUDLA.Physics;

      let moveForward = input.moveForward || 0;
      let moveRight = input.moveRight || 0;
      let runHeld = Boolean(input.run);
      let jumpPressed = isFirstSubstep && Boolean(input.jumpPressed);
      let jumpHeld = Boolean(input.jumpHeld);
      const firePressed = isFirstSubstep && Boolean(input.firePressed);

      if (this.autoplay && moveForward === 0 && moveRight === 0) {
        moveForward = 1;
        runHeld = true;
        jumpHeld = true;
        const targetZ =
          this.player.x >= 32 && this.player.x <= 66 ? 1.35 : 0;
        const zError = targetZ - this.player.z;
        if (Math.abs(zError) > 0.05) {
          moveRight = Math.max(-0.6, Math.min(0.6, zError * 1.5));
        }
        this.autoplayTimer += fixedDt;
        if (this.autoplayTimer >= 0.9) {
          this.autoplayTimer -= 0.9;
          jumpPressed = true;
        } else if (this.player.onGround) {
          // Jump when an active crab is directly ahead on the path
          for (let i = 0; i < this.enemies.length; i++) {
            const enm = this.enemies[i];
            if (
              enm.state === 'active' &&
              enm.type === 'crab' &&
              Math.abs(enm.z - this.player.z) < 0.95
            ) {
              const dxCrab = enm.x - this.player.x;
              if (dxCrab >= 0.25 && dxCrab <= 2.1) {
                this.autoplayTimer = 0;
                jumpPressed = true;
                break;
              }
            }
          }
          if (!jumpPressed && this.autoplayTimer >= 0.35) {
            // Also jump before pit edges or beneath cashew blocks if grounded
            const lookAheadFloor = KUDLA.Level.floorTopAt(
              this.level,
              this.player.x + 1.2,
              this.player.z
            );
            if (lookAheadFloor === null) {
              this.autoplayTimer = 0;
              jumpPressed = true;
            } else {
              for (let i = 0; i < this.blocks.length; i++) {
                const blk = this.blocks[i];
                if (
                  !blk.broken &&
                  ((blk.kind === 'mystery' && blk.contents === 'cashew') ||
                    (blk.kind === 'tile' && blk.contents === 'multi')) &&
                  Math.abs(blk.z - this.player.z) < 0.8
                ) {
                  const dx = blk.x - this.player.x;
                  if (dx >= 1.25 && dx <= 1.85) {
                    this.autoplayTimer = 0;
                    jumpPressed = true;
                    break;
                  }
                }
              }
            }
          }
        }
      }

      const cosYaw = Math.cos(this.yaw);
      const sinYaw = Math.sin(this.yaw);
      this.reusableMotionInput.moveX = moveForward * cosYaw - moveRight * sinYaw;
      this.reusableMotionInput.moveZ = moveForward * sinYaw + moveRight * cosYaw;
      this.reusableMotionInput.run = runHeld;
      this.reusableMotionInput.jumpPressed = jumpPressed;
      this.reusableMotionInput.jumpHeld = jumpHeld;

      const motionResult = Physics.updatePlayerMotion(
        this.player,
        this.reusableMotionInput,
        fixedDt
      );
      if (motionResult.jumped) {
        this.audio.play(this.power === 'small' ? 'jump' : 'bigjump');
      }

      if (this.collidersDirty) {
        this.rebuildBlockColliders();
      }

      // Include hidden blocks only while player rises with head at or below block bottom
      let collidersForPlayer = this.solidBlockColliders;
      if (this.player.vy > 0) {
        const playerTop = this.player.y + this.player.height;
        let hasEligibleHidden = false;
        for (let i = 0; i < this.blocks.length; i++) {
          const blk = this.blocks[i];
          if (
            !blk.broken &&
            blk.kind === 'hidden' &&
            playerTop <= blk.y + Config.COLLISION_EPSILON * 2
          ) {
            hasEligibleHidden = true;
            break;
          }
        }
        if (hasEligibleHidden) {
          this.playerStepColliders.length = 0;
          for (let i = 0; i < this.solidBlockColliders.length; i++) {
            this.playerStepColliders.push(this.solidBlockColliders[i]);
          }
          for (let i = 0; i < this.blocks.length; i++) {
            const blk = this.blocks[i];
            if (
              !blk.broken &&
              blk.kind === 'hidden' &&
              playerTop <= blk.y + Config.COLLISION_EPSILON * 2
            ) {
              this.playerStepColliders.push({ aabb: blk.aabb, ref: blk });
            }
          }
          collidersForPlayer = this.playerStepColliders;
        }
      }

      const prevBottomY = this.player.y;
      const prevVy = this.player.vy;
      const wasOnGround = this.player.onGround;

      const stepResult = Physics.stepBody(
        this.player,
        fixedDt,
        collidersForPlayer
      );

      if (stepResult.onGround) {
        this.stompChainIndex = 0;
        if (!wasOnGround && prevVy < -10) {
          this.landingDip = Config.CAMERA.LANDING_DIP;
        }
      }

      if (stepResult.hitHead && stepResult.hitHead.isBlock) {
        this.handleBlockHit(stepResult.hitHead);
      }

      // Throw chilli fireball
      if (
        firePressed &&
        this.power === 'fire' &&
        this.fireballs.length < Config.MAX_FIREBALLS
      ) {
        this.spawnFireball();
      }

      // Update blocks, shards, cashew pops, items, fireballs, cashews, enemies
      this.updateBlocks(fixedDt);
      this.updateShards(fixedDt);
      this.updateCashewPops(fixedDt);
      this.updatePopups(fixedDt);

      const playerAABB = Physics.bodyAABB(this.player);
      this.updateFreeCashews(playerAABB);
      this.updateItems(fixedDt, playerAABB);
      this.updateFireballs(fixedDt);
      this.updateEnemies(fixedDt, prevBottomY, jumpHeld);

      if (this.state !== 'playing') {
        return;
      }

      // Checkpoint
      if (!this.checkpointReached && this.player.x >= this.level.checkpoint.x) {
        this.checkpointReached = true;
        this.audio.play('chime');
        this.hud.toast(COPY.TOAST_CHECKPOINT, 'info');
      }

      // Flagpole trigger
      if (this.player.x >= this.level.flag.x) {
        this.enterFlagSequence(prevBottomY);
        return;
      }

      // Pit death
      if (this.player.y < Config.KILL_Y) {
        this.triggerDeath(COPY.DEAD_DEFAULT);
        return;
      }

      // Timers
      if (this.starTime > 0) {
        this.starTime = Math.max(0, this.starTime - fixedDt);
        if (this.starTime === 0) {
          this.hud.flash('none');
          this.audio.startMusic(this.time <= Config.HURRY_TIME ? 'hurry' : 'main');
        }
      }
      if (this.invulnTime > 0) {
        this.invulnTime = Math.max(0, this.invulnTime - fixedDt);
      }
      if (this.growFlickerTime > 0) {
        this.growFlickerTime = Math.max(0, this.growFlickerTime - fixedDt);
      }

      // Level clock
      this.time = Math.max(0, this.time - fixedDt);
      if (!this.hurryTriggered && this.time <= Config.HURRY_TIME && this.time > 0) {
        this.hurryTriggered = true;
        this.audio.play('hurry');
        if (this.starTime <= 0) {
          this.audio.startMusic('hurry');
        }
        this.hud.setHurry(true);
        this.hud.toast(COPY.TOAST_HURRY, 'warn');
        this.audio.announce(COPY.ANNOUNCE_HURRY);
      }
      if (this.time <= 0) {
        this.triggerDeath(COPY.DEAD_TIMEUP);
        return;
      }

      // Camera kinematics (bob, landing dip, FOV)
      const horizSpeed = Math.hypot(this.player.vx, this.player.vz);
      if (this.player.onGround && horizSpeed > 0.2) {
        this.bobPhase += (horizSpeed / Config.CAMERA.BOB_STRIDE) * Math.PI * 2 * fixedDt;
        const speedScale = Math.min(1, horizSpeed / Config.RUN_SPEED);
        this.bobOffset = Math.sin(this.bobPhase) * Config.CAMERA.BOB_AMPLITUDE * speedScale;
      } else {
        this.bobOffset *= Math.max(0, 1 - 10 * fixedDt);
      }

      if (this.landingDip > 0) {
        this.landingDip = Math.max(0, this.landingDip - 1.2 * fixedDt);
      }

      const targetFov =
        horizSpeed > Config.WALK_SPEED + 1.0 ? Config.CAMERA.RUN_FOV : Config.CAMERA.FOV;
      const fovDiff = targetFov - this.fov;
      const maxFovStep = 35 * fixedDt;
      if (Math.abs(fovDiff) <= maxFovStep) {
        this.fov = targetFov;
      } else {
        this.fov += Math.sign(fovDiff) * maxFovStep;
      }
    }

    /**
     * Handles hitting a block from below.
     * @param {!Object} block
     */
    handleBlockHit(block) {
      const Config = KUDLA.Config;
      const Models = KUDLA.Models;

      if (block.broken) {
        return;
      }
      if (block.kind === 'used' || block.kind === 'laterite') {
        this.audio.play('tick');
        return;
      }

      this.handleBlockTopReactions(block);

      if (block.kind === 'hidden') {
        block.kind = 'used';
        block.bumpTimer = Config.BUMP_TIME;
        if (block.mesh) {
          block.mesh.visible = true;
          if (Models) Models.setBlockKind(block.mesh, 'used');
        }
        this.collidersDirty = true;
        this.audio.play('powerup_appear');
        this.spawnEmergingItem(block, 'coconut');
        block.contents = 'none';
        return;
      }

      if (block.kind === 'mystery') {
        block.kind = 'used';
        block.bumpTimer = Config.BUMP_TIME;
        if (block.mesh && Models) {
          Models.setBlockKind(block.mesh, 'used');
        }
        this.audio.play('bump');
        if (block.contents === 'cashew') {
          this.spawnCashewPop(block);
          this.collectCashew(block.x, block.y + Config.BLOCK + 0.4, block.z);
        } else if (block.contents === 'powerup') {
          this.audio.play('powerup_appear');
          const itemType = this.power === 'small' ? 'buns' : 'gheeroast';
          this.spawnEmergingItem(block, itemType);
        } else if (block.contents === 'star') {
          this.audio.play('powerup_appear');
          this.spawnEmergingItem(block, 'gadbad');
        } else if (block.contents === 'oneup') {
          this.audio.play('powerup_appear');
          this.spawnEmergingItem(block, 'coconut');
        }
        block.contents = 'none';
        return;
      }

      if (block.kind === 'tile') {
        if (block.contents === 'star') {
          block.kind = 'used';
          block.bumpTimer = Config.BUMP_TIME;
          if (block.mesh && Models) {
            Models.setBlockKind(block.mesh, 'used');
          }
          this.audio.play('bump');
          this.audio.play('powerup_appear');
          this.spawnEmergingItem(block, 'gadbad');
          block.contents = 'none';
        } else if (block.contents === 'multi') {
          if (block.multiCount === 0) {
            block.multiTimer = Config.MULTI_CASHEW_WINDOW;
          }
          block.multiCount += 1;
          block.bumpTimer = Config.BUMP_TIME;
          this.spawnCashewPop(block);
          this.collectCashew(block.x, block.y + Config.BLOCK + 0.4, block.z);
          if (
            block.multiCount >= Config.MULTI_CASHEW_MAX ||
            block.multiTimer <= 0
          ) {
            block.kind = 'used';
            block.contents = 'none';
            if (block.mesh && Models) {
              Models.setBlockKind(block.mesh, 'used');
            }
          }
        } else {
          // tile / none
          if (this.power === 'big' || this.power === 'fire') {
            block.broken = true;
            if (block.mesh) {
              block.mesh.visible = false;
              if (this.dynamicGroup) {
                this.dynamicGroup.remove(block.mesh);
              }
            }
            this.collidersDirty = true;
            this.score += Config.SCORE.BRICK;
            this.audio.play('break');
            this.spawnShards(block);
            this.spawnScorePopup(
              String(Config.SCORE.BRICK),
              block.x,
              block.y + Config.BLOCK,
              block.z
            );
          } else {
            block.bumpTimer = Config.BUMP_TIME;
            this.audio.play('bump');
          }
        }
      }
    }

    /**
     * Kills enemies standing on a bumped block and pops items on it upward.
     * @param {!Object} block
     */
    handleBlockTopReactions(block) {
      const Config = KUDLA.Config;
      const topY = block.y + Config.BLOCK;
      const halfBlock = Config.BLOCK / 2;

      for (let i = 0; i < this.enemies.length; i++) {
        const enm = this.enemies[i];
        if (enm.state !== 'active' || enm.type !== 'crab') {
          continue;
        }
        const overlapX =
          Math.abs(enm.x - block.x) < halfBlock + enm.width / 2;
        const overlapZ =
          Math.abs(enm.z - block.z) < halfBlock + enm.depth / 2;
        const onTop = Math.abs(enm.y - topY) < 0.25;
        if (overlapX && overlapZ && onTop) {
          enm.state = 'dead';
          enm.vy = 7.0;
          enm.vx = (enm.dir || 1) * 2.0;
          enm.deadTimer = 0.9;
          this.score += Config.SCORE.BUMP_KILL;
          this.audio.play('kick');
          this.spawnScorePopup(
            String(Config.SCORE.BUMP_KILL),
            enm.x,
            enm.y + enm.height,
            enm.z
          );
        }
      }

      for (let i = 0; i < this.items.length; i++) {
        const itm = this.items[i];
        if (itm.emergingTimer > 0) {
          continue;
        }
        const overlapX =
          Math.abs(itm.x - block.x) < halfBlock + itm.width / 2;
        const overlapZ =
          Math.abs(itm.z - block.z) < halfBlock + itm.depth / 2;
        const onTop = Math.abs(itm.y - topY) < 0.25;
        if (overlapX && overlapZ && onTop) {
          itm.vy = 6.0;
          itm.onGround = false;
        }
      }
    }

    /**
     * Collects a cashew and handles 100-cashew extra life wrap.
     * @param {number} posX
     * @param {number} posY
     * @param {number} posZ
     */
    collectCashew(posX, posY, posZ) {
      const Config = KUDLA.Config;
      this.cashews += 1;
      this.score += Config.SCORE.CASHEW;
      this.audio.play('cashew');
      this.spawnScorePopup(String(Config.SCORE.CASHEW), posX, posY, posZ);

      if (this.cashews >= Config.CASHEWS_PER_LIFE) {
        this.cashews -= Config.CASHEWS_PER_LIFE;
        this.lives += 1;
        this.audio.play('oneup');
        this.hud.toast(COPY.TOAST_CASHEWS, 'bonus');
        this.spawnScorePopup(
          '1-UP',
          this.player.x,
          this.player.y + this.player.height,
          this.player.z
        );
      }
    }

    /**
     * Spawns an emerging item from a block.
     * @param {!Object} block
     * @param {string} itemType 'buns' | 'gheeroast' | 'gadbad' | 'coconut'
     */
    spawnEmergingItem(block, itemType) {
      const Config = KUDLA.Config;
      const Models = KUDLA.Models;
      const mesh = Models ? Models.createItem(itemType) : null;
      const startY = block.y + 0.2;
      const targetY = block.y + Config.BLOCK + Config.COLLISION_EPSILON * 2;
      if (mesh) {
        mesh.position.set(block.x, startY, block.z);
        if (this.dynamicGroup) {
          this.dynamicGroup.add(mesh);
        }
      }
      this.items.push({
        type: itemType,
        x: block.x,
        y: startY,
        z: block.z,
        startY: startY,
        targetY: targetY,
        vx: 0,
        vy: 0,
        vz: 0,
        width: Config.ITEM_SIZE,
        height: Config.ITEM_SIZE,
        depth: Config.ITEM_SIZE,
        dir: 1,
        speed: Config.ITEM_SPEED,
        onGround: false,
        emergingTimer: Config.ITEM_EMERGE_TIME,
        mesh: mesh,
      });
    }

    /**
     * Spawns 4 terracotta shards when a brick breaks.
     * @param {!Object} block
     */
    spawnShards(block) {
      const Config = KUDLA.Config;
      const Models = KUDLA.Models;
      const offsets = [
        [-0.2, 0.7, -0.2, -2.8, 7.5, -1.5],
        [0.2, 0.7, -0.2, 2.8, 7.5, -1.5],
        [-0.2, 0.3, 0.2, -2.4, 5.5, 1.5],
        [0.2, 0.3, 0.2, 2.4, 5.5, 1.5],
      ];
      for (let i = 0; i < offsets.length; i++) {
        const off = offsets[i];
        const mesh = Models ? Models.createShard() : null;
        const posX = block.x + off[0];
        const posY = block.y + off[1];
        const posZ = block.z + off[2];
        if (mesh) {
          mesh.position.set(posX, posY, posZ);
          if (this.dynamicGroup) {
            this.dynamicGroup.add(mesh);
          }
        }
        this.shards.push({
          x: posX,
          y: posY,
          z: posZ,
          vx: off[3],
          vy: off[4],
          vz: off[5],
          lifetime: Config.SHARD_LIFETIME,
          mesh: mesh,
        });
      }
    }

    /**
     * Spawns a visual cashew pop animation above a hit block.
     * @param {!Object} block
     */
    spawnCashewPop(block) {
      const Config = KUDLA.Config;
      const Models = KUDLA.Models;
      const mesh = Models ? Models.createCashew() : null;
      const baseY = block.y + Config.BLOCK;
      if (mesh) {
        mesh.position.set(block.x, baseY, block.z);
        if (this.dynamicGroup) {
          this.dynamicGroup.add(mesh);
        }
      }
      this.cashewPops.push({
        x: block.x,
        baseY: baseY,
        z: block.z,
        timer: Config.CASHEW_POP_TIME,
        mesh: mesh,
      });
    }

    /**
     * Spawns a rising score popup sprite.
     * @param {string} text
     * @param {number} posX
     * @param {number} posY
     * @param {number} posZ
     */
    spawnScorePopup(text, posX, posY, posZ) {
      const Models = KUDLA.Models;
      const sprite = Models ? Models.createScorePopup(text) : null;
      if (sprite) {
        sprite.position.set(posX, posY, posZ);
        if (this.dynamicGroup) {
          this.dynamicGroup.add(sprite);
        }
      }
      this.popups.push({
        text: text,
        x: posX,
        startY: posY,
        y: posY,
        z: posZ,
        elapsed: 0,
        duration: 0.8,
        sprite: sprite,
      });
    }

    /**
     * Spawns a chilli fireball ahead of the player eye.
     */
    spawnFireball() {
      const Config = KUDLA.Config;
      const Models = KUDLA.Models;
      const cosYaw = Math.cos(this.yaw);
      const sinYaw = Math.sin(this.yaw);
      const eyeY = this.player.y + this.player.height - Config.EYE_BELOW_TOP;
      const posX = this.player.x + cosYaw * 0.5;
      const posY = Math.max(this.player.y + 0.1, eyeY - 0.4);
      const posZ = this.player.z + sinYaw * 0.5;
      const mesh = Models ? Models.createFireball() : null;
      if (mesh) {
        mesh.position.set(posX, posY, posZ);
        if (this.dynamicGroup) {
          this.dynamicGroup.add(mesh);
        }
      }
      this.audio.play('fireball');
      this.fireballs.push({
        x: posX,
        y: posY,
        z: posZ,
        vx: cosYaw * Config.FIREBALL_SPEED,
        vy: 0,
        vz: sinYaw * Config.FIREBALL_SPEED,
        width: Config.FIREBALL_SIZE,
        height: Config.FIREBALL_SIZE,
        depth: Config.FIREBALL_SIZE,
        onGround: false,
        alive: true,
        lifetime: Config.FIREBALL_LIFETIME,
        mesh: mesh,
      });
    }

    /**
     * Updates block bump animations and multi-cashew timers.
     * @param {number} fixedDt
     */
    updateBlocks(fixedDt) {
      const Config = KUDLA.Config;
      const Models = KUDLA.Models;
      for (let i = 0; i < this.blocks.length; i++) {
        const blk = this.blocks[i];
        if (blk.broken) {
          continue;
        }
        if (blk.bumpTimer > 0) {
          blk.bumpTimer = Math.max(0, blk.bumpTimer - fixedDt);
          if (blk.mesh) {
            if (blk.bumpTimer > 0) {
              const elapsed = Config.BUMP_TIME - blk.bumpTimer;
              const fraction = Math.min(1, Math.max(0, elapsed / Config.BUMP_TIME));
              blk.mesh.position.y =
                blk.mesh.userData.baseY + Math.sin(fraction * Math.PI) * Config.BUMP_HEIGHT;
            } else {
              blk.mesh.position.y = blk.mesh.userData.baseY;
            }
          }
        }
        if (blk.kind === 'tile' && blk.contents === 'multi' && blk.multiCount > 0) {
          blk.multiTimer -= fixedDt;
          if (blk.multiTimer <= 0 && blk.bumpTimer <= 0) {
            blk.kind = 'used';
            blk.contents = 'none';
            if (blk.mesh && Models) {
              Models.setBlockKind(blk.mesh, 'used');
            }
          }
        }
      }
    }

    /**
     * Updates flying brick shards.
     * @param {number} fixedDt
     */
    updateShards(fixedDt) {
      const Config = KUDLA.Config;
      for (let i = this.shards.length - 1; i >= 0; i--) {
        const shd = this.shards[i];
        shd.lifetime -= fixedDt;
        if (shd.lifetime <= 0) {
          if (shd.mesh && this.dynamicGroup) {
            this.dynamicGroup.remove(shd.mesh);
          }
          this.shards.splice(i, 1);
          continue;
        }
        shd.vy -= Config.GRAVITY * fixedDt;
        shd.x += shd.vx * fixedDt;
        shd.y += shd.vy * fixedDt;
        shd.z += shd.vz * fixedDt;
        if (shd.mesh) {
          shd.mesh.position.set(shd.x, shd.y, shd.z);
          shd.mesh.rotation.x += 9 * fixedDt;
          shd.mesh.rotation.y += 7 * fixedDt;
        }
      }
    }

    /**
     * Updates popping cashews from blocks.
     * @param {number} fixedDt
     */
    updateCashewPops(fixedDt) {
      const Config = KUDLA.Config;
      const Models = KUDLA.Models;
      for (let i = this.cashewPops.length - 1; i >= 0; i--) {
        const pop = this.cashewPops[i];
        pop.timer -= fixedDt;
        if (pop.timer <= 0) {
          if (pop.mesh && this.dynamicGroup) {
            this.dynamicGroup.remove(pop.mesh);
          }
          this.cashewPops.splice(i, 1);
          continue;
        }
        const progress = 1 - pop.timer / Config.CASHEW_POP_TIME;
        const offsetY = Math.sin(progress * Math.PI) * Config.CASHEW_POP_HEIGHT;
        if (pop.mesh) {
          pop.mesh.position.set(pop.x, pop.baseY + offsetY, pop.z);
          if (Models) {
            Models.animate(pop.mesh, this.elapsedTime * 3);
          }
        }
      }
    }

    /**
     * Updates floating score popups (rise 1.2 m over 0.8 s).
     * @param {number} fixedDt
     */
    updatePopups(fixedDt) {
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const pop = this.popups[i];
        pop.elapsed += fixedDt;
        if (pop.elapsed >= pop.duration) {
          if (pop.sprite && this.dynamicGroup) {
            this.dynamicGroup.remove(pop.sprite);
          }
          this.popups.splice(i, 1);
          continue;
        }
        const fraction = pop.elapsed / pop.duration;
        pop.y = pop.startY + fraction * 1.2;
        if (pop.sprite) {
          pop.sprite.position.set(pop.x, pop.y, pop.z);
          if (pop.sprite.material) {
            pop.sprite.material.opacity = 1 - fraction;
          }
        }
      }
    }

    /**
     * Updates spinning free cashews and checks player collection.
     * @param {!Object} playerAABB
     */
    updateFreeCashews(playerAABB) {
      const Physics = KUDLA.Physics;
      const Models = KUDLA.Models;
      for (let i = this.cashewsList.length - 1; i >= 0; i--) {
        const csh = this.cashewsList[i];
        if (csh.collected) {
          continue;
        }
        if (csh.mesh && Models) {
          Models.animate(csh.mesh, this.elapsedTime);
        }
        if (Physics.intersects(playerAABB, csh.aabb)) {
          csh.collected = true;
          if (csh.mesh && this.dynamicGroup) {
            this.dynamicGroup.remove(csh.mesh);
          }
          this.cashewsList.splice(i, 1);
          this.collectCashew(csh.x, csh.y + 0.3, csh.z);
        }
      }
    }

    /**
     * Updates emerging and active power-up items and checks collection.
     * @param {number} fixedDt
     * @param {!Object} playerAABB
     */
    updateItems(fixedDt, playerAABB) {
      const Config = KUDLA.Config;
      const Physics = KUDLA.Physics;
      const Models = KUDLA.Models;

      for (let i = this.items.length - 1; i >= 0; i--) {
        const itm = this.items[i];
        if (itm.emergingTimer > 0) {
          itm.emergingTimer = Math.max(0, itm.emergingTimer - fixedDt);
          const frac = 1 - itm.emergingTimer / Config.ITEM_EMERGE_TIME;
          itm.y = itm.startY + (itm.targetY - itm.startY) * frac;
        } else {
          if (itm.type === 'buns' || itm.type === 'coconut') {
            Physics.stepWalker(itm, fixedDt, this.solidBlockColliders);
          } else if (itm.type === 'gadbad') {
            itm.vx = itm.dir * itm.speed;
            itm.vz = 0;
            const res = Physics.stepBody(itm, fixedDt, this.solidBlockColliders);
            if (res.hitWallX) {
              itm.dir = -itm.dir;
            }
            if (res.onGround) {
              itm.vy = Config.STAR_BOUNCE_VELOCITY;
            }
          } else {
            // gheeroast stays put horizontally
            itm.vx = 0;
            itm.vz = 0;
            Physics.stepBody(itm, fixedDt, this.solidBlockColliders);
          }
        }

        if (itm.y < Config.KILL_Y) {
          if (itm.mesh && this.dynamicGroup) {
            this.dynamicGroup.remove(itm.mesh);
          }
          this.items.splice(i, 1);
          continue;
        }

        if (itm.mesh) {
          itm.mesh.position.set(itm.x, itm.y, itm.z);
          if (Models) {
            Models.animate(itm.mesh, this.elapsedTime);
          }
        }

        const itemAABB = Physics.bodyAABB(itm);
        if (Physics.intersects(playerAABB, itemAABB)) {
          if (itm.mesh && this.dynamicGroup) {
            this.dynamicGroup.remove(itm.mesh);
          }
          this.items.splice(i, 1);
          this.collectItem(itm);
        }
      }
    }

    /**
     * Applies collected item effects.
     * @param {!Object} item
     */
    collectItem(item) {
      const Config = KUDLA.Config;
      if (item.type === 'buns') {
        this.score += Config.SCORE.POWERUP;
        this.spawnScorePopup(
          String(Config.SCORE.POWERUP),
          item.x,
          item.y + item.height,
          item.z
        );
        if (this.power === 'small') {
          this.setPowerState('big');
          this.growFlickerTime = Config.GROW_FLICKER_TIME;
        }
        this.audio.play('powerup');
        this.hud.flash('power');
        this.hud.toast(COPY.TOAST_BUNS, 'power');
      } else if (item.type === 'gheeroast') {
        this.score += Config.SCORE.POWERUP;
        this.spawnScorePopup(
          String(Config.SCORE.POWERUP),
          item.x,
          item.y + item.height,
          item.z
        );
        if (this.power !== 'fire') {
          this.setPowerState('fire');
          this.growFlickerTime = Config.GROW_FLICKER_TIME;
        }
        this.audio.play('powerup');
        this.hud.flash('power');
        this.hud.toast(COPY.TOAST_GHEEROAST, 'power');
      } else if (item.type === 'gadbad') {
        this.score += Config.SCORE.POWERUP;
        this.spawnScorePopup(
          String(Config.SCORE.POWERUP),
          item.x,
          item.y + item.height,
          item.z
        );
        this.starTime = Config.STAR_TIME;
        this.audio.play('powerup');
        this.audio.startMusic('star');
        this.hud.flash('star');
        this.hud.toast(COPY.TOAST_GADBAD, 'power');
      } else if (item.type === 'coconut') {
        this.lives += 1;
        this.spawnScorePopup('1-UP', item.x, item.y + item.height, item.z);
        this.audio.play('oneup');
        this.hud.toast(COPY.TOAST_COCONUT, 'bonus');
      }
    }

    /**
     * Updates active chilli fireballs and checks enemy hits.
     * @param {number} fixedDt
     */
    updateFireballs(fixedDt) {
      const Config = KUDLA.Config;
      const Physics = KUDLA.Physics;
      const Models = KUDLA.Models;

      for (let i = this.fireballs.length - 1; i >= 0; i--) {
        const fb = this.fireballs[i];
        fb.lifetime -= fixedDt;
        const stepRes = Physics.stepFireball(fb, fixedDt, this.solidBlockColliders);
        if (!stepRes.alive || fb.lifetime <= 0 || fb.y < Config.KILL_Y) {
          if (fb.mesh && this.dynamicGroup) {
            this.dynamicGroup.remove(fb.mesh);
          }
          this.fireballs.splice(i, 1);
          continue;
        }

        if (fb.mesh) {
          fb.mesh.position.set(fb.x, fb.y, fb.z);
          if (Models) {
            Models.animate(fb.mesh, this.elapsedTime);
          }
        }

        const fbAABB = Physics.bodyAABB(fb);
        let hitEnemy = false;
        for (let j = 0; j < this.enemies.length; j++) {
          const enm = this.enemies[j];
          if (enm.state !== 'active' || enm.hidden) {
            continue;
          }
          if (Physics.intersects(fbAABB, Physics.bodyAABB(enm))) {
            enm.state = 'dead';
            enm.vy = 6.0;
            enm.deadTimer = 0.8;
            if (enm.mesh && Models) {
              Models.animate(enm.mesh, this.elapsedTime, 'dead');
            }
            this.score += Config.SCORE.FIREBALL_KILL;
            this.audio.play('kick');
            this.spawnScorePopup(
              String(Config.SCORE.FIREBALL_KILL),
              enm.x,
              enm.y + enm.height,
              enm.z
            );
            hitEnemy = true;
            break;
          }
        }
        if (hitEnemy) {
          if (fb.mesh && this.dynamicGroup) {
            this.dynamicGroup.remove(fb.mesh);
          }
          this.fireballs.splice(i, 1);
        }
      }
    }

    /**
     * Updates crabs, crows, and chimney crows,crab-crab reversals, and player contacts.
     * @param {number} fixedDt
     * @param {number} prevBottomY
     * @param {boolean} jumpHeld
     */
    updateEnemies(fixedDt, prevBottomY, jumpHeld) {
      const Config = KUDLA.Config;
      const Physics = KUDLA.Physics;
      const Models = KUDLA.Models;

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enm = this.enemies[i];

        if (enm.state === 'squashed') {
          enm.squashTimer -= fixedDt;
          if (enm.mesh && Models) {
            Models.animate(enm.mesh, this.elapsedTime, 'squashed');
          }
          if (enm.squashTimer <= 0) {
            if (enm.mesh && this.dynamicGroup) {
              this.dynamicGroup.remove(enm.mesh);
            }
            this.enemies.splice(i, 1);
          }
          continue;
        }

        if (enm.state === 'dead') {
          enm.deadTimer -= fixedDt;
          enm.vy -= Config.GRAVITY * fixedDt;
          enm.x += enm.vx * fixedDt;
          enm.y += enm.vy * fixedDt;
          if (enm.mesh) {
            enm.mesh.position.set(enm.x, enm.y, enm.z);
            if (Models) {
              Models.animate(enm.mesh, this.elapsedTime, 'dead');
            }
          }
          if (enm.deadTimer <= 0 || enm.y < Config.KILL_Y) {
            if (enm.mesh && this.dynamicGroup) {
              this.dynamicGroup.remove(enm.mesh);
            }
            this.enemies.splice(i, 1);
          }
          continue;
        }

        if (!enm.activated) {
          if (Math.abs(enm.x - this.player.x) <= Config.ACTIVATION_DISTANCE) {
            enm.activated = true;
          } else {
            continue;
          }
        }

        if (enm.type === 'crab') {
          Physics.stepWalker(enm, fixedDt, this.solidBlockColliders);
          if (enm.y < Config.KILL_Y) {
            if (enm.mesh && this.dynamicGroup) {
              this.dynamicGroup.remove(enm.mesh);
            }
            this.enemies.splice(i, 1);
            continue;
          }
          if (enm.mesh && Models) {
            Models.animate(enm.mesh, this.elapsedTime, 'walk');
          }
        } else if (enm.type === 'crow') {
          enm.y =
            enm.baseY +
            Math.sin(this.elapsedTime * 3.0 + enm.phase) * Config.CROW_HOVER_AMPLITUDE;
          const dx = this.player.x - enm.x;
          const dz = this.player.z - enm.z;
          const distXZ = Math.hypot(dx, dz);
          if (distXZ <= Config.CROW_AGGRO_RANGE && distXZ > 0.01) {
            enm.x += (dx / distXZ) * Config.CROW_SPEED * fixedDt;
            enm.z += (dz / distXZ) * Config.CROW_SPEED * fixedDt;
          }
          if (enm.mesh && Models) {
            Models.animate(enm.mesh, this.elapsedTime, 'fly');
          }
        } else if (enm.type === 'chimney_crow') {
          const cyc = Config.CHIMNEY_CROW_CYCLE;
          const totalPeriod = cyc.hide + cyc.rise + cyc.show + cyc.sink;
          const distAxis = Math.hypot(this.player.x - enm.x, this.player.z - enm.z);
          if (enm.cycleTime < cyc.hide) {
            enm.cycleTime += fixedDt;
            if (
              enm.cycleTime >= cyc.hide &&
              distAxis <= Config.CHIMNEY_CROW_SAFE_RADIUS
            ) {
              enm.cycleTime = cyc.hide - 0.01;
            }
            enm.y = enm.hiddenY;
            enm.hidden = true;
          } else {
            enm.cycleTime = (enm.cycleTime + fixedDt) % totalPeriod;
            const afterHide = enm.cycleTime - cyc.hide;
            if (afterHide < cyc.rise) {
              const frac = afterHide / cyc.rise;
              enm.y = enm.hiddenY + (enm.topY - enm.hiddenY) * frac;
              enm.hidden = frac < 0.15;
            } else if (afterHide < cyc.rise + cyc.show) {
              enm.y = enm.topY;
              enm.hidden = false;
            } else {
              const sinkElapsed = afterHide - (cyc.rise + cyc.show);
              const frac = Math.min(1, sinkElapsed / cyc.sink);
              enm.y = enm.topY - (enm.topY - enm.hiddenY) * frac;
              enm.hidden = frac > 0.85;
            }
          }
          if (enm.mesh) {
            enm.mesh.visible = !enm.hidden;
            if (Models) {
              Models.animate(enm.mesh, this.elapsedTime, 'fly');
            }
          }
        }

        if (enm.mesh) {
          enm.mesh.position.set(enm.x, enm.y, enm.z);
          enm.mesh.rotation.y = Math.atan2(
            this.player.x - enm.x,
            this.player.z - enm.z
          );
        }
      }

      // Crab-crab mutual reversal
      for (let i = 0; i < this.enemies.length; i++) {
        const crabA = this.enemies[i];
        if (crabA.state !== 'active' || crabA.type !== 'crab' || !crabA.activated) {
          continue;
        }
        const aabbA = Physics.bodyAABB(crabA);
        for (let j = i + 1; j < this.enemies.length; j++) {
          const crabB = this.enemies[j];
          if (crabB.state !== 'active' || crabB.type !== 'crab' || !crabB.activated) {
            continue;
          }
          if (Physics.intersects(aabbA, Physics.bodyAABB(crabB))) {
            if (crabA.x <= crabB.x) {
              crabA.dir = -1;
              crabB.dir = 1;
              crabA.x -= 0.02;
              crabB.x += 0.02;
            } else {
              crabA.dir = 1;
              crabB.dir = -1;
              crabA.x += 0.02;
              crabB.x -= 0.02;
            }
          }
        }
      }

      // Player-enemy contact
      for (let i = 0; i < this.enemies.length; i++) {
        const enm = this.enemies[i];
        if (enm.state !== 'active' || enm.hidden) {
          continue;
        }
        const enemyAABB = Physics.bodyAABB(enm);
        const contact = Physics.classifyEnemyContact(
          prevBottomY,
          this.player,
          enemyAABB
        );
        if (!contact) {
          continue;
        }

        if (this.starTime > 0) {
          enm.state = 'dead';
          enm.vy = 6.0;
          enm.deadTimer = 0.8;
          if (enm.mesh && Models) {
            Models.animate(enm.mesh, this.elapsedTime, 'dead');
          }
          this.score += Config.SCORE.STAR_KILL;
          this.audio.play('kick');
          this.spawnScorePopup(
            String(Config.SCORE.STAR_KILL),
            enm.x,
            enm.y + enm.height,
            enm.z
          );
          continue;
        }

        if (contact === 'stomp' && enm.type !== 'chimney_crow') {
          if (enm.type === 'crab') {
            enm.state = 'squashed';
            enm.squashTimer = Config.CRAB_SQUASH_TIME;
            if (enm.mesh && Models) {
              Models.animate(enm.mesh, this.elapsedTime, 'squashed');
            }
          } else {
            enm.state = 'dead';
            enm.vy = -2.0;
            enm.deadTimer = 0.9;
            if (enm.mesh && Models) {
              Models.animate(enm.mesh, this.elapsedTime, 'dead');
            }
          }
          this.player.vy = jumpHeld
            ? Config.STOMP_BOUNCE_HELD_VELOCITY
            : Config.STOMP_BOUNCE_VELOCITY;
          this.player.onGround = false;
          this.player.jumping = true;
          this.player.jumpCutUsed = false;

          if (this.stompChainIndex < Config.STOMP_CHAIN.length) {
            const chainScore = Config.STOMP_CHAIN[this.stompChainIndex];
            this.score += chainScore;
            this.audio.play('stomp');
            this.spawnScorePopup(
              String(chainScore),
              enm.x,
              enm.y + enm.height,
              enm.z
            );
          } else {
            this.lives += 1;
            this.audio.play('oneup');
            this.spawnScorePopup('1-UP', enm.x, enm.y + enm.height, enm.z);
          }
          this.stompChainIndex += 1;
        } else {
          // Hurt contact
          if (this.invulnTime > 0) {
            continue;
          }
          if (this.power === 'big' || this.power === 'fire') {
            this.setPowerState('small');
            this.invulnTime = Config.INVULN_TIME;
            this.growFlickerTime = Config.GROW_FLICKER_TIME;
            this.audio.play('hurt');
            this.hud.flash('hurt');
            this.hud.toast(COPY.TOAST_HURT, 'warn');
          } else {
            this.triggerDeath(COPY.DEAD_DEFAULT);
            return;
          }
        }
      }
    }

    /**
     * Initiates player death sequence.
     * @param {string} message
     */
    triggerDeath(message) {
      if (this.state !== 'playing') {
        return;
      }
      const Config = KUDLA.Config;
      this.state = 'dying';
      this.deathMessage = message || COPY.DEAD_DEFAULT;
      this.deathTimer = Config.DEATH_ANIM_TIME;
      this.deadScreenTimer = Config.DEAD_SCREEN_TIME;
      this.deadScreenShown = false;
      this.lives -= 1;
      this.power = 'small';
      this.starTime = 0;
      this.invulnTime = 0;
      this.growFlickerTime = 0;
      this.hud.flash('hurt');
      this.audio.stopMusic();
      this.audio.setRumble(0);
      this.audio.play('die');
    }

    /**
     * Advances death animation, dead screen wait, respawn, or game over.
     * @param {number} fixedDt
     */
    stepDying(fixedDt) {
      const Config = KUDLA.Config;
      if (this.deathTimer > 0) {
        this.deathTimer = Math.max(0, this.deathTimer - fixedDt);
        const progress = 1 - this.deathTimer / Config.DEATH_ANIM_TIME;
        this.cameraRoll = progress * 0.65;
        this.deathSink = progress * 0.75;
        return;
      }

      if (this.lives <= 0) {
        this.state = 'gameover';
        this.hud.showScreen('gameover', {
          message: COPY.GAMEOVER_MSG,
          score: this.score,
        });
        return;
      }

      if (!this.deadScreenShown) {
        this.deadScreenShown = true;
        this.hud.showScreen('dead', {
          message: this.deathMessage,
          lives: this.lives,
        });
      }

      this.deadScreenTimer = Math.max(0, this.deadScreenTimer - fixedDt);
      if (this.deadScreenTimer <= 0) {
        this.time = Config.LEVEL_TIME;
        this.hurryTriggered = false;
        this.power = 'small';
        this.loadLevel(KUDLA.Level.create());
        this.state = 'playing';
        this.hud.setHurry(false);
        this.hud.flash('none');
        this.hud.showScreen('none');
        this.audio.startMusic('main');
      }
    }

    /**
     * Enters the flagpole sequence upon crossing flag.x.
     * @param {number=} prevBottomY Player bottom Y at start of substep.
     */
    enterFlagSequence(prevBottomY) {
      const Config = KUDLA.Config;
      this.state = 'flag';
      this.flagPhase = 'slide';
      this.flagPhaseTimer = 0;
      this.audio.stopMusic();
      this.audio.setRumble(0);
      this.audio.play('flag');
      this.hud.flash('none');

      const rawFeetY =
        typeof prevBottomY === 'number'
          ? Math.max(prevBottomY, this.player.y)
          : this.player.y;
      const feetY = Math.max(0, rawFeetY);
      let awarded = 100;
      for (let i = 0; i < Config.FLAG_SCORES.length; i++) {
        const entry = Config.FLAG_SCORES[i];
        if (feetY >= entry[0]) {
          awarded = entry[1];
          break;
        }
      }
      this.flagBonus = awarded;
      this.score += awarded;

      this.player.x = this.level.flag.x;
      this.player.z = this.level.flag.z;
      this.player.vx = 0;
      this.player.vy = 0;
      this.player.vz = 0;

      this.spawnScorePopup(
        String(awarded),
        this.level.flag.x,
        Math.max(1.2, feetY),
        this.level.flag.z
      );

      this.remainingWholeSeconds = Math.max(0, Math.ceil(this.time));
      this.initialRemainingSeconds = Math.max(1, this.remainingWholeSeconds);
      this.timeBonus = 0;
      this.tallyTickAccum = 0;
      this.trainSpeed = 0;
    }

    /**
     * Advances the flagpole slide, walk to coach door, train departure, and time bonus tally.
     * @param {number} fixedDt
     */
    stepFlag(fixedDt) {
      const Config = KUDLA.Config;
      this.updatePopups(fixedDt);
      this.flagPhaseTimer += fixedDt;

      if (this.flagPhase === 'slide') {
        this.player.y = Math.max(0, this.player.y - 8.0 * fixedDt);
        let flagLowered = true;
        if (
          this.scenery &&
          this.scenery.flagPole &&
          this.scenery.flagPole.userData &&
          this.scenery.flagPole.userData.flag
        ) {
          const flagObj = this.scenery.flagPole.userData.flag;
          flagObj.position.y = Math.max(1.0, flagObj.position.y - 8.0 * fixedDt);
          if (flagObj.position.y > 1.05 && this.flagPhaseTimer < 1.5) {
            flagLowered = false;
          }
        }
        if (this.player.y <= 0 && flagLowered) {
          this.player.y = 0;
          this.flagPhase = 'walk';
          this.flagPhaseTimer = 0;
        }
      } else if (this.flagPhase === 'walk') {
        const doorX = this.level.train.doorX;
        const doorZ = 3.3;
        const dx = doorX - this.player.x;
        const dz = doorZ - this.player.z;
        const dist = Math.hypot(dx, dz);
        const stepDist = Config.WALK_SPEED * fixedDt;

        if (dist <= stepDist || dist < 0.1) {
          this.player.x = doorX;
          this.player.z = doorZ;
          this.player.vx = 0;
          this.player.vz = 0;
          this.audio.play('horn');
          this.audio.play('clear');
          this.flagPhase = 'depart';
          this.flagPhaseTimer = 0;
        } else {
          this.player.vx = (dx / dist) * Config.WALK_SPEED;
          this.player.vz = (dz / dist) * Config.WALK_SPEED;
          this.player.x += this.player.vx * fixedDt;
          this.player.z += this.player.vz * fixedDt;
          this.yaw = Math.atan2(dz, dx);
        }
      } else if (this.flagPhase === 'depart') {
        this.trainSpeed += Config.TRAIN.DEPART_ACCEL * fixedDt;
        if (this.scenery && this.scenery.standingTrain) {
          this.scenery.standingTrain.position.x += this.trainSpeed * fixedDt;
        }

        // Count remaining seconds into TIME_BONUS_PER_SECOND points
        if (this.remainingWholeSeconds > 0) {
          const rate = Math.max(60, this.initialRemainingSeconds / 4.0);
          this.tallyTickAccum += rate * fixedDt;
          while (this.tallyTickAccum >= 1 && this.remainingWholeSeconds > 0) {
            this.tallyTickAccum -= 1;
            this.remainingWholeSeconds -= 1;
            this.time = this.remainingWholeSeconds;
            this.timeBonus += Config.SCORE.TIME_BONUS_PER_SECOND;
            this.score += Config.SCORE.TIME_BONUS_PER_SECOND;
            if (this.elapsedTime - this.lastTickSoundTime >= 0.06) {
              this.lastTickSoundTime = this.elapsedTime;
              this.audio.play('tick');
            }
          }
        }

        if (this.flagPhaseTimer >= 5.0 && this.remainingWholeSeconds <= 0) {
          this.state = 'clear';
          const isNewBest = this.score > this.bestScore;
          if (isNewBest) {
            this.bestScore = this.score;
            if (this.onBestScore) {
              this.onBestScore(this.bestScore);
            }
          }
          this.hud.showScreen('clear', {
            score: this.score,
            timeBonus: this.timeBonus,
            flagBonus: this.flagBonus,
            best: this.bestScore,
            newBest: isNewBest,
          });
        }
      }
    }

    /**
     * Computes and returns the current camera state `{eye, yaw, pitch, mode, fov, roll}`.
     * @return {!{eye: !{x: number, y: number, z: number}, yaw: number, pitch: number, mode: string, fov: number, roll: number}}
     */
    getCameraState() {
      const Config = KUDLA.Config;
      const eye = this.reusableCameraEye;

      if (
        (this.state === 'flag' && this.flagPhase === 'depart') ||
        this.state === 'clear'
      ) {
        const camX = this.level.train.doorX - 14;
        const camY = 3.2;
        const camZ = -2.5;
        eye.x = camX;
        eye.y = camY;
        eye.z = camZ;
        const targetX = this.level.train.doorX + this.trainSpeed * 1.2;
        const targetZ = this.level.train.z;
        this.reusableCameraState.yaw = Math.atan2(targetZ - camZ, targetX - camX);
        this.reusableCameraState.pitch = -0.06;
        this.reusableCameraState.mode = 'third';
        this.reusableCameraState.fov = Config.CAMERA.FOV;
        this.reusableCameraState.roll = 0;
        return this.reusableCameraState;
      }

      const shakeAmp = 0.04 * (this.currentRumble || 0);
      const shakeX = shakeAmp > 0 ? Math.sin(this.elapsedTime * 47) * shakeAmp : 0;
      const shakeY = shakeAmp > 0 ? Math.cos(this.elapsedTime * 53) * shakeAmp : 0;

      if (this.cameraMode === 'third') {
        if (this.collidersDirty) {
          this.rebuildBlockColliders();
        }
        const pivotX = this.player.x;
        const pivotY = this.player.y + this.player.height * 0.6;
        const pivotZ = this.player.z;

        const baseThirdHeight =
          this.power === 'small' ? 1.45 : Config.CAMERA.THIRD_HEIGHT;
        const desiredX =
          this.player.x - Math.cos(this.yaw) * Config.CAMERA.THIRD_DISTANCE;
        const desiredY = Math.max(
          0.35,
          this.player.y + baseThirdHeight - Math.sin(this.pitch) * 1.5
        );
        const desiredZ =
          this.player.z - Math.sin(this.yaw) * Config.CAMERA.THIRD_DISTANCE;

        const segDx = desiredX - pivotX;
        const segDy = desiredY - pivotY;
        const segDz = desiredZ - pivotZ;
        const segLen = Math.hypot(segDx, segDy, segDz);

        const segMinX = Math.min(pivotX, desiredX);
        const segMaxX = Math.max(pivotX, desiredX);
        const segMinY = Math.min(pivotY, desiredY);
        const segMaxY = Math.max(pivotY, desiredY);
        const segMinZ = Math.min(pivotZ, desiredZ);
        const segMaxZ = Math.max(pivotZ, desiredZ);

        let minHitDist = segLen;
        let hasHit = false;

        for (let i = 0; i < this.solidBlockColliders.length; i++) {
          const col = this.solidBlockColliders[i];
          const ref = col.ref;
          if (ref && ref.kind === 'barrier' && ref.z > 3.5) {
            continue;
          }
          const aabb = col.aabb;
          if (
            aabb.maxX < segMinX ||
            aabb.minX > segMaxX ||
            aabb.maxY < segMinY ||
            aabb.minY > segMaxY ||
            aabb.maxZ < segMinZ ||
            aabb.minZ > segMaxZ
          ) {
            continue;
          }
          const hitT = intersectSegmentAABB(
            pivotX,
            pivotY,
            pivotZ,
            segDx,
            segDy,
            segDz,
            aabb
          );
          if (hitT >= 0) {
            const hitDist = hitT * segLen;
            if (hitDist < minHitDist) {
              minHitDist = hitDist;
              hasHit = true;
            }
          }
        }

        const targetDist = hasHit
          ? Math.max(0.6, minHitDist - 0.25)
          : segLen;
        const camDt = this.thirdPersonCamDt;
        this.thirdPersonCamDt = 0;

        if (targetDist <= this.thirdPersonDist) {
          this.thirdPersonDist = targetDist;
        } else if (camDt > 0) {
          this.thirdPersonDist = Math.min(
            targetDist,
            this.thirdPersonDist + 8.0 * camDt
          );
        }

        const ratio = segLen > 1e-6 ? this.thirdPersonDist / segLen : 0;
        eye.x = pivotX + segDx * ratio + shakeX;
        eye.y = Math.max(0.35, pivotY + segDy * ratio) + shakeY;
        eye.z = pivotZ + segDz * ratio;

        const horizDist = Math.hypot(pivotX - eye.x, pivotZ - eye.z);
        const lookAtChestPitch = Math.atan2(
          pivotY - 0.15 - eye.y,
          Math.max(0.1, horizDist)
        );
        this.reusableCameraState.pitch = Math.max(
          -Config.CAMERA.PITCH_LIMIT,
          Math.min(Config.CAMERA.PITCH_LIMIT, this.pitch + lookAtChestPitch)
        );
      } else {
        eye.x = this.player.x + shakeX;
        eye.y =
          this.player.y +
          this.player.height -
          Config.EYE_BELOW_TOP +
          this.bobOffset -
          this.landingDip -
          this.deathSink +
          shakeY;
        eye.z = this.player.z;
        this.reusableCameraState.pitch = this.pitch;
      }

      this.reusableCameraState.yaw = this.yaw;
      this.reusableCameraState.mode = this.cameraMode;
      this.reusableCameraState.fov = this.fov;
      this.reusableCameraState.roll = this.cameraRoll;
      return this.reusableCameraState;
    }

    /**
     * Returns a snapshot of the current game telemetry state.
     * @return {!{
     *   state: string,
     *   score: number,
     *   cashews: number,
     *   lives: number,
     *   time: number,
     *   power: string,
     *   starTime: number,
     *   progress: number,
     *   playerPos: !{x: number, y: number, z: number},
     *   cameraMode: string,
     *   muted: boolean
     * }}
     */
    getState() {
      const startX = this.level.playerStart.x;
      const flagX = this.level.flag.x;
      const span = Math.max(1, flagX - startX);
      const progress = Math.max(0, Math.min(1, (this.player.x - startX) / span));
      return {
        state: this.state,
        score: this.score,
        cashews: this.cashews,
        lives: this.lives,
        time: this.time,
        power: this.power,
        starTime: this.starTime,
        progress: progress,
        playerPos: {
          x: this.player.x,
          y: this.player.y,
          z: this.player.z,
        },
        cameraMode: this.cameraMode,
        muted: this.audio.isMuted(),
      };
    }
  }

  KUDLA.Game = Game;
  if (typeof module === 'object' && module.exports) {
    module.exports = Game;
  }
})(typeof window !== 'undefined' ? window : globalThis);
