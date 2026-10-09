/**
 * @fileoverview Node.js smoke and rules test suite for KUDLA.Game.
 * Runs in a fake_dom VM context with recording audio/hud stubs.
 * Verifies all DESIGN.md section 9 gameplay mechanics.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createContext, loadScripts } = require('./helpers/fake_dom.js');

describe('KUDLA.Game Rules & Integration Smoke Tests', () => {
  const context = createContext();
  loadScripts(context, [
    'vendor/three.min.js',
    'assets/posters.js',
    'src/config.js',
    'src/level.js',
    'src/physics.js',
    'src/textures.js',
    'src/models.js',
    'src/scenery.js',
    'src/game.js',
  ]);

  const THREE = context.THREE;
  const Config = context.KUDLA.Config;
  const Level = context.KUDLA.Level;
  const Scenery = context.KUDLA.Scenery;
  const Game = context.KUDLA.Game;

  /**
   * Creates recording audio and HUD stubs plus a fresh Game instance.
   * @param {!Object=} options
   */
  function createTestGame(options) {
    const playedSounds = [];
    const musicModes = [];
    const announcements = [];
    const screensShown = [];
    const toasts = [];
    const flashes = [];
    let hurryState = false;
    let mutedState = false;

    const audioStub = {
      init: () => {},
      play: (name) => playedSounds.push(name),
      startMusic: (mode) => musicModes.push(mode),
      stopMusic: () => musicModes.push('stop'),
      setMuted: (bool) => {
        mutedState = Boolean(bool);
      },
      isMuted: () => mutedState,
      toggleMute: () => {
        mutedState = !mutedState;
        return mutedState;
      },
      announce: (text) => announcements.push(text),
      setRumble: () => {},
    };

    const hudStub = {
      init: () => {},
      on: () => {},
      update: () => {},
      toast: (text, variant) => toasts.push({ text, variant }),
      showScreen: (name, data) => screensShown.push({ name, data }),
      setHurry: (active) => {
        hurryState = Boolean(active);
      },
      flash: (kind) => flashes.push(kind),
      setCrosshairVisible: () => {},
      setLoadingProgress: () => {},
    };

    const scene = new THREE.Scene();
    const level = Level.create();
    const scenery = Scenery ? Scenery.build(scene, level) : null;
    const game = new Game({
      scene: scene,
      level: level,
      scenery: scenery,
      audio: audioStub,
      hud: hudStub,
      options: options || {},
    });

    return {
      game,
      playedSounds,
      musicModes,
      announcements,
      screensShown,
      toasts,
      flashes,
      getHurryState: () => hurryState,
    };
  }

  test('30 s autoplay-style run executes without throwing and makes forward progress', () => {
    const { game, announcements } = createTestGame({ autoplay: true });
    game.start();
    assert.strictEqual(announcements.length, 1, 'First start should announce train departure');

    const startX = game.getState().playerPos.x;
    let maxReachedX = startX;
    const totalSteps = Math.round(30 / Config.FIXED_DT);

    for (let i = 0; i < totalSteps; i++) {
      game.step(Config.FIXED_DT, {});
      const posX = game.getState().playerPos.x;
      if (posX > maxReachedX) {
        maxReachedX = posX;
      }
    }

    assert.ok(
      maxReachedX > startX + 60,
      `Expected significant forward progress along Platform 1, reached x=${maxReachedX}`
    );
  });

  test('Mystery block hit from below gives a cashew and turns used', () => {
    const { game, playedSounds } = createTestGame();
    game.start();

    const blocks = game.debug.entities().blocks;
    const mysteryBlock = blocks.find((blk) => blk.id === 'block-12');
    assert.ok(mysteryBlock, 'block-12 must exist');
    assert.strictEqual(mysteryBlock.kind, 'mystery');

    // Position player directly beneath block-12 and jump into it
    const player = game.debug.entities().player;
    game.debug.teleport(
      mysteryBlock.x,
      mysteryBlock.y - player.height - 0.08,
      mysteryBlock.z
    );
    player.vy = 8.0;
    player.onGround = false;

    for (let i = 0; i < 10; i++) {
      game.step(Config.FIXED_DT, {});
    }

    const state = game.getState();
    assert.strictEqual(mysteryBlock.kind, 'used', 'Mystery block must turn used');
    assert.strictEqual(state.cashews, 1, 'Cashew count must increment by 1');
    assert.strictEqual(state.score, Config.SCORE.CASHEW, 'Score must increase by 200');
    assert.ok(playedSounds.includes('cashew'), 'Must play cashew sound');
  });

  test('Small player bumps a tile block; big player breaks it (+50)', () => {
    const { game, playedSounds } = createTestGame();
    game.start();

    const blocks = game.debug.entities().blocks;
    const tileBlock = blocks.find(
      (blk) => blk.kind === 'tile' && blk.contents === 'none'
    );
    assert.ok(tileBlock, 'Standard tile block must exist');

    const player = game.debug.entities().player;
    game.debug.teleport(
      tileBlock.x,
      tileBlock.y - player.height - 0.08,
      tileBlock.z
    );
    player.vy = 8.0;
    player.onGround = false;

    for (let i = 0; i < 6; i++) {
      game.step(Config.FIXED_DT, {});
    }

    assert.strictEqual(tileBlock.broken, false, 'Small player must not break tile');
    assert.ok(tileBlock.bumpTimer > 0, 'Tile block must be bumping');
    assert.ok(playedSounds.includes('bump'), 'Must play bump sound');

    // Now grow to big and hit the same tile block from below
    game.debug.setPower('big');
    const scoreBefore = game.getState().score;
    game.debug.teleport(
      tileBlock.x,
      tileBlock.y - player.height - 0.08,
      tileBlock.z
    );
    player.vy = 8.0;
    player.onGround = false;

    for (let i = 0; i < 6; i++) {
      game.step(Config.FIXED_DT, {});
    }

    assert.strictEqual(tileBlock.broken, true, 'Big player must break tile block');
    assert.strictEqual(
      game.getState().score,
      scoreBefore + Config.SCORE.BRICK,
      'Breaking tile must award +50 points'
    );
    assert.strictEqual(
      game.debug.entities().shards.length,
      4,
      'Breaking tile must spawn 4 shards'
    );
    assert.ok(playedSounds.includes('break'), 'Must play break sound');
  });

  test('Stomp squashes a crab, bounces player, and awards +100', () => {
    const { game, playedSounds } = createTestGame();
    game.start();

    const crab = game.debug
      .entities()
      .enemies.find((enm) => enm.id === 'crab-27');
    assert.ok(crab, 'crab-27 must exist');

    const player = game.debug.entities().player;
    // Place player just above crab top with downward velocity
    game.debug.teleport(crab.x, crab.y + crab.height + 0.05, crab.z);
    player.vy = -6.0;
    player.onGround = false;

    for (let i = 0; i < 6; i++) {
      game.step(Config.FIXED_DT, {});
      if (crab.state === 'squashed') {
        break;
      }
    }

    assert.strictEqual(crab.state, 'squashed', 'Crab must be squashed');
    assert.ok(player.vy > 0, 'Player must bounce upward after stomp');
    assert.strictEqual(game.getState().score, 100, 'Stomp must award 100 points');
    assert.ok(playedSounds.includes('stomp'), 'Must play stomp sound');
  });

  test('Side contact with an enemy while small starts dying', () => {
    const { game, playedSounds } = createTestGame();
    game.start();

    const crab = game.debug
      .entities()
      .enemies.find((enm) => enm.id === 'crab-41');
    assert.ok(crab, 'crab-41 must exist');

    // Place small player overlapping crab from the side on the floor
    game.debug.teleport(crab.x + 0.2, 0, crab.z);
    game.step(Config.FIXED_DT, {});

    assert.strictEqual(
      game.getState().state,
      'dying',
      'Side contact while small must transition to dying'
    );
    assert.ok(playedSounds.includes('die'), 'Must play die sound');
  });

  test('Mangalore Buns item makes the player big', () => {
    const { game, playedSounds, toasts } = createTestGame();
    game.start();

    const powerBlock = game.debug
      .entities()
      .blocks.find((blk) => blk.kind === 'mystery' && blk.contents === 'powerup');
    assert.ok(powerBlock, 'Powerup mystery block must exist');

    const player = game.debug.entities().player;
    game.debug.teleport(
      powerBlock.x,
      powerBlock.y - player.height - 0.08,
      powerBlock.z
    );
    player.vy = 8.0;
    player.onGround = false;

    // Step to hit block and let buns emerge
    const emergeSteps = Math.ceil((Config.ITEM_EMERGE_TIME + 0.1) / Config.FIXED_DT);
    for (let i = 0; i < emergeSteps; i++) {
      game.step(Config.FIXED_DT, {});
    }

    const items = game.debug.entities().items;
    assert.strictEqual(items.length, 1, 'Buns item must have spawned');
    assert.strictEqual(items[0].type, 'buns');

    // Teleport onto the emerged buns item to collect it
    game.debug.teleport(items[0].x, items[0].y, items[0].z);
    game.step(Config.FIXED_DT, {});

    assert.strictEqual(game.getState().power, 'big', 'Player power must become big');
    assert.strictEqual(
      player.height,
      Config.PLAYER_HEIGHT_BIG,
      'Player height must grow to PLAYER_HEIGHT_BIG'
    );
    assert.ok(playedSounds.includes('powerup'), 'Must play powerup sound');
    assert.ok(
      toasts.some((tst) => tst.text.includes('MANGALORE BUNS')),
      'Must show Mangalore Buns toast'
    );
  });

  test('Falling into Pit A triggers dying state', () => {
    const { game } = createTestGame();
    game.start();

    // Pit A spans x [70, 74]
    game.debug.teleport(72.0, -1.0, 0);
    for (let i = 0; i < 120; i++) {
      game.step(Config.FIXED_DT, {});
      if (game.getState().state === 'dying') {
        break;
      }
    }

    assert.strictEqual(
      game.getState().state,
      'dying',
      'Falling below KILL_Y in Pit A must start dying'
    );
  });

  test('Crossing flag.x enters flag state and completes clear sequence with time bonus', () => {
    const { game, screensShown, playedSounds } = createTestGame();
    game.start();

    const flagX = game.level.flag.x;
    game.debug.teleport(flagX + 0.05, 6.0, 0);
    game.step(Config.FIXED_DT, {});

    assert.strictEqual(
      game.getState().state,
      'flag',
      'Crossing flag.x must enter flag state'
    );
    assert.ok(playedSounds.includes('flag'), 'Must play flag sound');

    // Step through pole slide, walk to door, and 5s train departure
    const maxFlagSteps = Math.ceil(9.0 / Config.FIXED_DT);
    for (let i = 0; i < maxFlagSteps; i++) {
      game.step(Config.FIXED_DT, {});
      if (game.getState().state === 'clear') {
        break;
      }
    }

    assert.strictEqual(
      game.getState().state,
      'clear',
      'Flag sequence must finish in clear state'
    );
    const clearScreen = screensShown.find((scr) => scr.name === 'clear');
    assert.ok(clearScreen, 'Clear screen must be shown');
    assert.ok(clearScreen.data.timeBonus > 0, 'Time bonus must be positive');
    assert.ok(clearScreen.data.flagBonus >= 800, 'Flag bonus at y=6 must be >= 800');
  });

  test('Timer reaching 0 triggers death with time-up message', () => {
    const { game, screensShown } = createTestGame();
    game.start();

    game.debug.forceTime(0.02);
    for (let i = 0; i < 10; i++) {
      game.step(Config.FIXED_DT, {});
    }

    assert.strictEqual(
      game.getState().state,
      'dying',
      'Timer reaching 0 must start dying'
    );

    // Advance past DEATH_ANIM_TIME to show dead screen
    const deathSteps = Math.ceil((Config.DEATH_ANIM_TIME + 0.1) / Config.FIXED_DT);
    for (let i = 0; i < deathSteps; i++) {
      game.step(Config.FIXED_DT, {});
    }

    const deadScreen = screensShown.find((scr) => scr.name === 'dead');
    assert.ok(deadScreen, 'Dead screen must be shown');
    assert.strictEqual(
      deadScreen.data.message,
      'TIME UP! The train left without you.'
    );
  });

  test('Respawn resets level entities while preserving score and cashews', () => {
    const { game } = createTestGame();
    game.start();

    // Collect cashew from block-12
    const mysteryBlock = game.debug
      .entities()
      .blocks.find((blk) => blk.id === 'block-12');
    const player = game.debug.entities().player;
    game.debug.teleport(
      mysteryBlock.x,
      mysteryBlock.y - player.height - 0.08,
      mysteryBlock.z
    );
    player.vy = 8.0;
    player.onGround = false;
    for (let i = 0; i < 8; i++) {
      game.step(Config.FIXED_DT, {});
    }

    assert.strictEqual(mysteryBlock.kind, 'used');
    const savedScore = game.getState().score;
    const savedCashews = game.getState().cashews;
    assert.ok(savedScore > 0);
    assert.strictEqual(savedCashews, 1);

    // Fall into Pit A and wait through DEATH_ANIM_TIME + DEAD_SCREEN_TIME
    game.debug.teleport(72.0, Config.KILL_Y - 0.5, 0);
    const respawnSteps = Math.ceil(
      (Config.DEATH_ANIM_TIME + Config.DEAD_SCREEN_TIME + 0.3) / Config.FIXED_DT
    );
    for (let i = 0; i < respawnSteps; i++) {
      game.step(Config.FIXED_DT, {});
    }

    const afterState = game.getState();
    assert.strictEqual(afterState.state, 'playing', 'Must respawn into playing state');
    assert.strictEqual(afterState.score, savedScore, 'Score must be kept across respawn');
    assert.strictEqual(
      afterState.cashews,
      savedCashews,
      'Cashews must be kept across respawn'
    );
    assert.strictEqual(
      afterState.lives,
      Config.START_LIVES - 1,
      'Lives must decrement by 1'
    );

    const freshBlock12 = game.debug
      .entities()
      .blocks.find((blk) => blk.id === 'block-12');
    assert.strictEqual(
      freshBlock12.kind,
      'mystery',
      'Respawn must rebuild level with fresh blocks'
    );
  });

  test('Third-person camera at x=40 facing +X collides with x=36 chimney and stays outside its AABB', () => {
    const { game } = createTestGame({
      spawnX: 40,
      cameraMode: 'third',
    });
    game.start();
    game.step(Config.FIXED_DT, {});

    const cam = game.getCameraState();
    const player = game.debug.entities().player;
    const pivotX = player.x;
    const pivotY = player.y + player.height * 0.6;
    const pivotZ = player.z;
    const distFromPivot = Math.hypot(
      cam.eye.x - pivotX,
      cam.eye.y - pivotY,
      cam.eye.z - pivotZ
    );

    // Chimney at x=36 has w=1.8, d=1.8, h=2.0 -> AABB minX=35.1, maxX=36.9, minY=0, maxY=2.0, minZ=-0.9, maxZ=0.9
    const insideChimney =
      cam.eye.x > 35.1 &&
      cam.eye.x < 36.9 &&
      cam.eye.y >= 0 &&
      cam.eye.y <= 2.0 &&
      cam.eye.z > -0.9 &&
      cam.eye.z < 0.9;

    assert.strictEqual(
      insideChimney,
      false,
      `Camera eye (${cam.eye.x}, ${cam.eye.y}, ${cam.eye.z}) must be outside x=36 chimney AABB`
    );
    assert.ok(
      cam.eye.x > 36.9,
      `Camera eye.x (${cam.eye.x}) must be pulled in front of chimney maxX (36.9)`
    );
    assert.ok(
      distFromPivot >= 0.6 - 1e-6,
      `Camera must be at least 0.6 m from pivot, got ${distFromPivot}`
    );

    // Verify camera eases out at 8 m/s when obstruction clears
    game.debug.teleport(20, 0, 0);
    // Force obstructed distance first, then step 0.05 s in open space
    game.thirdPersonDist = 1.5;
    game.thirdPersonCamDt = 0;
    game.step(0.05, {});
    const easedCam = game.getCameraState();
    const easedDist = Math.hypot(
      easedCam.eye.x - 20,
      easedCam.eye.y - (0 + player.height * 0.6),
      easedCam.eye.z
    );
    assert.ok(
      Math.abs(easedDist - (1.5 + 8.0 * 0.05)) < 0.05,
      `Expected camera to ease out at 8 m/s to ~1.9 m, got ${easedDist}`
    );
  });

  test('Spawn override ?x=72 over Pit A dies once and respawns at playerStart with lives 2', () => {
    const { game } = createTestGame({ spawnX: 72 });
    game.start();

    const totalSteps = Math.ceil(6.0 / Config.FIXED_DT);
    let sawDying = false;
    for (let i = 0; i < totalSteps; i++) {
      game.step(Config.FIXED_DT, {});
      if (game.getState().state === 'dying') {
        sawDying = true;
      }
    }

    const finalState = game.getState();
    assert.strictEqual(sawDying, true, 'Must enter dying after spawning over Pit A at x=72');
    assert.strictEqual(finalState.state, 'playing', 'Must respawn into playing state');
    assert.strictEqual(finalState.lives, 2, 'Must have 2 lives after respawning');
    assert.strictEqual(
      finalState.playerPos.x,
      game.level.playerStart.x,
      'Must respawn at playerStart.x instead of repeating x=72 pit spawn'
    );
  });

  test('Autoplay starting at x=14 bumps block-17 cashew block within 8 s', () => {
    const { game } = createTestGame({ autoplay: true, spawnX: 14 });
    game.start();

    const totalSteps = Math.ceil(4.0 / Config.FIXED_DT);
    for (let i = 0; i < totalSteps; i++) {
      game.step(Config.FIXED_DT, {});
    }

    const st = game.getState();
    assert.ok(st.cashews >= 1, `Expected cashews >= 1 from block bump, got ${st.cashews}`);
    assert.ok(st.score >= 200, `Expected score >= 200 from block bump, got ${st.score}`);
  });
});

