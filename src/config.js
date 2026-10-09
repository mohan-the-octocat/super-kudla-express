/**
 * @fileoverview Super Kudla Express: shared tuning constants and the single
 * source of truth for every module. Units are metres and seconds. +X runs
 * along Platform 1 toward the train, +Y is up, +Z points toward the tracks.
 * The platform top is y = 0. See DESIGN.md for the full module contract.
 */
(function (root) {
  'use strict';
  const KUDLA = (root.KUDLA = root.KUDLA || {});

  /**
   * Recursively freezes an object graph so no module can mutate shared tuning.
   * @param {!Object} value Object to freeze.
   * @return {!Object} The same object, frozen.
   */
  function deepFreeze(value) {
    Object.values(value).forEach((child) => {
      if (child && typeof child === 'object') {
        deepFreeze(child);
      }
    });
    return Object.freeze(value);
  }

  const Config = deepFreeze({
    BLOCK: 1.0,

    // Player physics.
    GRAVITY: 30,
    MAX_FALL_SPEED: 25,
    WALK_SPEED: 6.5,
    RUN_SPEED: 10.0,
    GROUND_ACCEL: 50,
    AIR_ACCEL: 22,
    GROUND_DECEL: 40,
    AIR_DECEL: 4,
    JUMP_VELOCITY: 13.0,
    RUN_JUMP_VELOCITY: 14.0,
    RUN_JUMP_SPEED_THRESHOLD: 7.0,
    JUMP_CUT_MULTIPLIER: 0.45,
    COYOTE_TIME: 0.1,
    JUMP_BUFFER_TIME: 0.12,
    STOMP_BOUNCE_VELOCITY: 10.0,
    STOMP_BOUNCE_HELD_VELOCITY: 13.0,
    STOMP_TOLERANCE: 0.3,
    COLLISION_EPSILON: 0.001,

    // Player body and run rules.
    PLAYER_WIDTH: 0.6,
    PLAYER_HEIGHT_SMALL: 1.1,
    PLAYER_HEIGHT_BIG: 1.8,
    EYE_BELOW_TOP: 0.15,
    START_LIVES: 3,
    INVULN_TIME: 2.0,
    STAR_TIME: 10.0,
    GROW_FLICKER_TIME: 0.6,
    KILL_Y: -3.5,
    ACTIVATION_DISTANCE: 40,

    // Clock and death pacing.
    LEVEL_TIME: 240,
    HURRY_TIME: 60,
    DEATH_ANIM_TIME: 2.4,
    DEAD_SCREEN_TIME: 1.6,

    // Chilli fireballs (Ghee Roast power).
    FIREBALL_SPEED: 15,
    FIREBALL_BOUNCE_VELOCITY: 7,
    FIREBALL_SIZE: 0.5,
    FIREBALL_LIFETIME: 2.5,
    MAX_FIREBALLS: 2,

    // Items and collectibles.
    ITEM_SIZE: 0.8,
    ITEM_SPEED: 3.0,
    ITEM_EMERGE_TIME: 0.6,
    STAR_BOUNCE_VELOCITY: 9,
    CASHEW_SIZE: 0.6,
    CASHEW_POP_HEIGHT: 1.2,
    CASHEW_POP_TIME: 0.5,
    MULTI_CASHEW_WINDOW: 4.0,
    MULTI_CASHEW_MAX: 8,
    CASHEWS_PER_LIFE: 100,

    // Blocks.
    BUMP_HEIGHT: 0.3,
    BUMP_TIME: 0.2,
    SHARD_LIFETIME: 1.2,

    // Enemies.
    CRAB_SPEED: 1.6,
    CRAB_SIZE: {w: 0.9, h: 0.6, d: 0.9},
    CRAB_SQUASH_TIME: 0.6,
    CROW_SPEED: 3.2,
    CROW_SIZE: {w: 0.8, h: 0.5, d: 0.8},
    CROW_AGGRO_RANGE: 14,
    CROW_HOVER_AMPLITUDE: 0.6,
    CHIMNEY_CROW_SIZE: {w: 0.8, h: 0.9, d: 0.8},
    CHIMNEY_CROW_CYCLE: {rise: 1.0, show: 1.2, sink: 1.0, hide: 1.6},
    CHIMNEY_CROW_SAFE_RADIUS: 1.6,

    // Scoring.
    SCORE: {
      CASHEW: 200,
      BRICK: 50,
      POWERUP: 1000,
      FIREBALL_KILL: 200,
      STAR_KILL: 200,
      BUMP_KILL: 100,
      TIME_BONUS_PER_SECOND: 50,
    },
    STOMP_CHAIN: [100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000],
    // [minimum feet height on the flag pole, points], checked top-down.
    FLAG_SCORES: [[10, 5000], [8, 2000], [6, 800], [4, 400], [2, 200], [0, 100]],

    // Camera.
    CAMERA: {
      FOV: 75,
      RUN_FOV: 82,
      NEAR: 0.05,
      FAR: 900,
      THIRD_DISTANCE: 5.0,
      THIRD_HEIGHT: 2.2,
      MOUSE_SENSITIVITY: 0.0022,
      PITCH_LIMIT: 1.45,
      BOB_AMPLITUDE: 0.05,
      BOB_STRIDE: 1.6,
      LANDING_DIP: 0.15,
    },

    FIXED_DT: 1 / 120,
    MAX_FRAME_DT: 0.05,

    // Station cross-section. See DESIGN.md section 4.
    GEOMETRY: {
      PLATFORM_TOP: 0,
      PLATFORM_BOTTOM: -1.2,
      WALL_Z: -4.0,
      BARRIER_Z: 3.6,
      COPING_Z: 4.0,
      TACTILE_Z0: 2.6,
      TACTILE_Z1: 3.0,
      TRACK1_Z: 6.0,
      TRACK2_Z: 11.0,
      RAIL_TOP_Y: -0.9,
      BALLAST_Y: -1.2,
      GAUGE: 1.676,
      BOUNDARY_WALL_Z: 14.5,
      CANOPY_Y: 8.0,
      BUILDING_HEIGHT: 6.0,
      PIT_WATER_Y: -3.0,
      LEVEL_START_X: -6,
      LEVEL_END_X: 240,
    },

    // 12620 Matsyagandha Express: Mangaluru Central (MAQ) to Lokmanya Tilak
    // Terminus (LTT), Mumbai.
    TRAIN: {
      NUMBER: '12620',
      NAME: 'MATSYAGANDHA EXPRESS',
      FROM: 'MANGALURU CENTRAL',
      TO: 'LOKMANYA TILAK (T) MUMBAI',
      CAR_LENGTH: 22,
      LOCO_LENGTH: 19,
      DEPART_ACCEL: 1.5,
    },
    GOODS_TRAIN: {FIRST_PASS: 14, INTERVAL: 45, SPEED: 18, WAGONS: 24},

    PALETTE: {
      terracotta: '#C2512A',
      terracottaDark: '#8E3A1E',
      terracottaLight: '#E07A4F',
      laterite: '#A04A2E',
      lateriteDark: '#6B2D1B',
      lateritePore: '#3F1A10',
      gold: '#F4B41A',
      goldDark: '#B9800C',
      goldLight: '#FFD866',
      usedBlock: '#6E4B33',
      cream: '#F3E3C3',
      dado: '#8E2F22',
      doorGreen: '#2F5D3A',
      pillarGreen: '#2F4F3A',
      irYellow: '#FFD100',
      ink: '#151515',
      ledAmber: '#FFB000',
      railSteel: '#8A8F96',
      sleeper: '#A19E97',
      ballast: '#7D7468',
      platformStone: '#B9B4AA',
      tactileYellow: '#F2C200',
      coping: '#D8D3C8',
      leaf: '#3E8E41',
      leafDark: '#2A6430',
      trunk: '#7A5A3A',
      sky: '#5BA8E5',
      horizon: '#FDE7C8',
      fog: '#F3E2C7',
      water: '#2E5E5A',
      chilli: '#D7261E',
      cashew: '#E9B949',
      crab: '#E2572B',
      crow: '#1B1B1F',
      crowNape: '#6C6F75',
      coachBlue: '#1F4E9C',
      coachBand: '#F4F1E8',
      locoRed: '#B3261E',
      locoCream: '#F1E2B8',
      wagonBrown: '#6B3A24',
      flagGreen: '#1E9E3A',
    },

    STORAGE_KEYS: {
      BEST: 'kudla.best',
      SENSITIVITY: 'kudla.sensitivity',
      INVERT_Y: 'kudla.invertY',
      MUTED: 'kudla.muted',
      CAMERA: 'kudla.camera',
    },
  });

  KUDLA.Config = Config;
  if (typeof module === 'object' && module.exports) {
    module.exports = Config;
  }
})(typeof window !== 'undefined' ? window : globalThis);
