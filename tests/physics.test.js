/**
 * @fileoverview Test suite for physics engine (DESIGN.md §6).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const Config = require('../src/config.js');
const Physics = require('../src/physics.js');
const Level = require('../src/level.js');

describe('KUDLA.Physics', () => {
  it('landing sets onGround and zeroes vy', () => {
    const body = {
      x: 0,
      y: 2.0,
      z: 0,
      vx: 0,
      vy: -5.0,
      vz: 0,
      width: Config.PLAYER_WIDTH,
      height: Config.PLAYER_HEIGHT_SMALL,
      depth: Config.PLAYER_WIDTH,
      onGround: false,
    };
    const floorCollider = {
      aabb: Physics.makeAABB(0, -1.2, 0, 10, 1.2, 10),
      ref: { id: 'floor', kind: 'platform' },
    };
    const dt = Config.FIXED_DT;

    let landed = false;
    for (let stepIndex = 0; stepIndex < 60; stepIndex++) {
      const stepResult = Physics.stepBody(body, dt, [floorCollider]);
      if (stepResult.onGround) {
        landed = true;
        assert.equal(body.onGround, true);
        assert.equal(body.vy, 0);
        assert.equal(stepResult.landedOn, floorCollider.ref);
        assert.ok(Math.abs(body.y - 0.0) <= 0.01, 'body should rest on floor top');
        break;
      }
    }
    assert.equal(landed, true, 'body must land on floor');
  });

  it('wall stops horizontal movement along X', () => {
    const body = {
      x: 0,
      y: 0,
      z: 0,
      vx: 5.0,
      vy: 0,
      vz: 0,
      width: Config.PLAYER_WIDTH,
      height: Config.PLAYER_HEIGHT_SMALL,
      depth: Config.PLAYER_WIDTH,
      onGround: true,
    };
    const wallCollider = {
      aabb: Physics.makeAABB(2.5, 0, 0, 1.0, 3.0, 5.0), // minX = 2.0
      ref: { id: 'test-wall', kind: 'barrier' },
    };
    const dt = Config.FIXED_DT;

    let stopped = false;
    for (let stepIndex = 0; stepIndex < 100; stepIndex++) {
      const stepResult = Physics.stepBody(body, dt, [wallCollider], { gravity: 0 });
      if (stepResult.hitWallX) {
        stopped = true;
        assert.equal(body.vx, 0);
        assert.ok(body.x <= 2.0 - Config.PLAYER_WIDTH / 2 + 0.005);
        assert.ok(stepResult.wallRefs.includes(wallCollider.ref));
        break;
      }
    }
    assert.equal(stopped, true, 'body must be stopped by wall on X');
  });

  it('head bump picks the larger-overlap block of two', () => {
    // Body at x = 10.1, width = 0.6 spans [9.8, 10.4]
    // Block 1 spans [9.0, 10.0] -> overlap with body is [9.8, 10.0] = 0.2
    // Block 2 spans [10.0, 11.0] -> overlap with body is [10.0, 10.4] = 0.4
    // Block 2 has larger overlap area, so hitHead must be Block 2
    const body = {
      x: 10.1,
      y: 1.8,
      z: 0,
      vx: 0,
      vy: 15.0,
      vz: 0,
      width: 0.6,
      height: 1.1,
      depth: 0.6,
      onGround: false,
    };
    const block1 = {
      aabb: Physics.makeAABB(9.5, 3.0, 0, 1.0, 1.0, 1.0),
      ref: { id: 'block-small-overlap', x: 9.5 },
    };
    const block2 = {
      aabb: Physics.makeAABB(10.5, 3.0, 0, 1.0, 1.0, 1.0),
      ref: { id: 'block-large-overlap', x: 10.5 },
    };
    const dt = 1 / 60;
    const stepResult = Physics.stepBody(body, dt, [block1, block2], { gravity: 0 });

    assert.equal(stepResult.hitHead, block2.ref, 'hitHead must pick larger overlap block');
    assert.equal(body.vy, 0);
  });

  it('coyote jump works at 0.08 s and fails at 0.15 s', () => {
    // Coyote time is 0.10 s
    // Test 1: at 0.08 s elapsed after leaving ground, jump succeeds
    const playerA = {
      x: 0,
      y: 1.0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: false,
      coyoteTimer: Config.COYOTE_TIME,
      jumpBufferTimer: 0,
      jumping: false,
      jumpCutUsed: false,
    };
    // Step forward 0.08s without jump
    Physics.updatePlayerMotion(playerA, { moveX: 0, moveZ: 0, run: false, jumpPressed: false, jumpHeld: false }, 0.08);
    assert.ok(playerA.coyoteTimer > 0, 'coyote timer should still be positive at 0.08s');

    // Press jump now
    const resultA = Physics.updatePlayerMotion(
      playerA,
      { moveX: 0, moveZ: 0, run: false, jumpPressed: true, jumpHeld: true },
      Config.FIXED_DT
    );
    assert.equal(resultA.jumped, true, 'jump must succeed at 0.08s coyote elapsed');
    assert.equal(playerA.vy, Config.JUMP_VELOCITY);

    // Test 2: at 0.15 s elapsed after leaving ground, jump fails
    const playerB = {
      x: 0,
      y: 1.0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: false,
      coyoteTimer: Config.COYOTE_TIME,
      jumpBufferTimer: 0,
      jumping: false,
      jumpCutUsed: false,
    };
    // Step forward 0.15s without jump
    Physics.updatePlayerMotion(playerB, { moveX: 0, moveZ: 0, run: false, jumpPressed: false, jumpHeld: false }, 0.15);
    assert.equal(playerB.coyoteTimer, 0, 'coyote timer must have expired at 0.15s');

    // Press jump now
    const resultB = Physics.updatePlayerMotion(
      playerB,
      { moveX: 0, moveZ: 0, run: false, jumpPressed: true, jumpHeld: true },
      Config.FIXED_DT
    );
    assert.equal(resultB.jumped, false, 'jump must fail at 0.15s coyote elapsed');
  });

  it('buffered jump fires on landing', () => {
    const player = {
      x: 0,
      y: 0.05,
      z: 0,
      vx: 0,
      vy: -4.0,
      vz: 0,
      width: Config.PLAYER_WIDTH,
      height: Config.PLAYER_HEIGHT_SMALL,
      depth: Config.PLAYER_WIDTH,
      onGround: false,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      jumping: false,
      jumpCutUsed: false,
    };
    const floorCollider = {
      aabb: Physics.makeAABB(0, -1.2, 0, 10, 1.2, 10),
      ref: { id: 'floor' },
    };
    const dt = Config.FIXED_DT;

    // Press jump in mid-air (buffer time is 0.12s)
    Physics.updatePlayerMotion(
      player,
      { moveX: 0, moveZ: 0, run: false, jumpPressed: true, jumpHeld: true },
      dt
    );
    assert.ok(player.jumpBufferTimer > 0, 'jump buffer timer should be active');

    // Step body until landing occurs (at vy = -4, y = 0.05 takes ~2 steps)
    for (let stepIndex = 0; stepIndex < 5; stepIndex++) {
      Physics.stepBody(player, dt, [floorCollider]);
      if (player.onGround) {
        break;
      }
    }
    assert.equal(player.onGround, true, 'player should have landed');
    assert.ok(player.jumpBufferTimer > 0, 'jump buffer timer should still be positive on landing');

    // Next step updatePlayerMotion should fire buffered jump
    const jumpResult = Physics.updatePlayerMotion(
      player,
      { moveX: 0, moveZ: 0, run: false, jumpPressed: false, jumpHeld: true },
      dt
    );
    assert.equal(jumpResult.jumped, true, 'buffered jump must trigger upon landing');
    assert.equal(player.vy, Config.JUMP_VELOCITY);
  });

  it('tap apex is at least 0.8 m lower than held apex', () => {
    const dt = Config.FIXED_DT;

    // 1. Held jump
    const playerHeld = {
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      width: Config.PLAYER_WIDTH,
      height: Config.PLAYER_HEIGHT_SMALL,
      depth: Config.PLAYER_WIDTH,
      onGround: true,
      coyoteTimer: Config.COYOTE_TIME,
      jumpBufferTimer: 0,
      jumping: false,
      jumpCutUsed: false,
    };
    Physics.updatePlayerMotion(
      playerHeld,
      { moveX: 0, moveZ: 0, run: false, jumpPressed: true, jumpHeld: true },
      dt
    );

    let apexHeld = 0;
    for (let stepIndex = 0; stepIndex < 200; stepIndex++) {
      Physics.updatePlayerMotion(
        playerHeld,
        { moveX: 0, moveZ: 0, run: false, jumpPressed: false, jumpHeld: true },
        dt
      );
      Physics.stepBody(playerHeld, dt, []);
      if (playerHeld.y > apexHeld) {
        apexHeld = playerHeld.y;
      }
      if (playerHeld.vy <= 0) {
        break;
      }
    }

    // 2. Tap jump (release jumpHeld on frame 2)
    const playerTap = {
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      width: Config.PLAYER_WIDTH,
      height: Config.PLAYER_HEIGHT_SMALL,
      depth: Config.PLAYER_WIDTH,
      onGround: true,
      coyoteTimer: Config.COYOTE_TIME,
      jumpBufferTimer: 0,
      jumping: false,
      jumpCutUsed: false,
    };
    Physics.updatePlayerMotion(
      playerTap,
      { moveX: 0, moveZ: 0, run: false, jumpPressed: true, jumpHeld: true },
      dt
    );

    let apexTap = 0;
    for (let stepIndex = 0; stepIndex < 200; stepIndex++) {
      // jumpHeld is released immediately
      Physics.updatePlayerMotion(
        playerTap,
        { moveX: 0, moveZ: 0, run: false, jumpPressed: false, jumpHeld: false },
        dt
      );
      Physics.stepBody(playerTap, dt, []);
      if (playerTap.y > apexTap) {
        apexTap = playerTap.y;
      }
      if (playerTap.vy <= 0) {
        break;
      }
    }

    const apexDifference = apexHeld - apexTap;
    assert.ok(
      apexDifference >= 0.8,
      `held apex (${apexHeld.toFixed(2)}) minus tap apex (${apexTap.toFixed(2)}) is ${apexDifference.toFixed(2)}, should be >= 0.8m`
    );
  });

  it('run jump apex exceeds walk jump apex', () => {
    const dt = Config.FIXED_DT;

    // Walk jump (horizontal speed = WALK_SPEED = 6.5 <= 7.0 threshold)
    const playerWalk = {
      x: 0,
      y: 0,
      z: 0,
      vx: Config.WALK_SPEED,
      vy: 0,
      vz: 0,
      width: Config.PLAYER_WIDTH,
      height: Config.PLAYER_HEIGHT_SMALL,
      depth: Config.PLAYER_WIDTH,
      onGround: true,
      coyoteTimer: Config.COYOTE_TIME,
      jumpBufferTimer: 0,
      jumping: false,
      jumpCutUsed: false,
    };
    Physics.updatePlayerMotion(
      playerWalk,
      { moveX: 1, moveZ: 0, run: false, jumpPressed: true, jumpHeld: true },
      dt
    );
    assert.equal(playerWalk.vy, Config.JUMP_VELOCITY);

    // Run jump (horizontal speed = RUN_SPEED = 10.0 > 7.0 threshold)
    const playerRun = {
      x: 0,
      y: 0,
      z: 0,
      vx: Config.RUN_SPEED,
      vy: 0,
      vz: 0,
      width: Config.PLAYER_WIDTH,
      height: Config.PLAYER_HEIGHT_SMALL,
      depth: Config.PLAYER_WIDTH,
      onGround: true,
      coyoteTimer: Config.COYOTE_TIME,
      jumpBufferTimer: 0,
      jumping: false,
      jumpCutUsed: false,
    };
    Physics.updatePlayerMotion(
      playerRun,
      { moveX: 1, moveZ: 0, run: true, jumpPressed: true, jumpHeld: true },
      dt
    );
    assert.equal(playerRun.vy, Config.RUN_JUMP_VELOCITY);

    assert.ok(
      playerRun.vy > playerWalk.vy,
      'run jump initial velocity must exceed walk jump initial velocity'
    );
  });

  it('classifies enemy contact into stomp, hurt, or null', () => {
    const enemyAABB = Physics.makeAABB(5.0, 0, 0, 0.9, 0.6, 0.9); // maxY = 0.6

    // Stomp: falling (vy < 0) and previous bottom above maxY - STOMP_TOLERANCE (0.6 - 0.3 = 0.3)
    const stompingBody = {
      x: 5.0,
      y: 0.35,
      z: 0,
      vy: -3.0,
      width: 0.6,
      height: 1.1,
    };
    const stompResult = Physics.classifyEnemyContact(0.5, stompingBody, enemyAABB);
    assert.equal(stompResult, 'stomp');

    // Hurt: overlapping from the side or moving upward
    const hurtingBody = {
      x: 5.0,
      y: 0.1,
      z: 0,
      vy: 2.0,
      width: 0.6,
      height: 1.1,
    };
    const hurtResult = Physics.classifyEnemyContact(0.1, hurtingBody, enemyAABB);
    assert.equal(hurtResult, 'hurt');

    // Null: non-overlapping body
    const farBody = {
      x: 10.0,
      y: 0,
      z: 0,
      vy: -1.0,
      width: 0.6,
      height: 1.1,
    };
    const nullResult = Physics.classifyEnemyContact(0.5, farBody, enemyAABB);
    assert.equal(nullResult, null);
  });

  it('walker reverses direction upon colliding with a wall', () => {
    const walker = {
      x: 1.5,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      width: 0.8,
      height: 0.6,
      depth: 0.8,
      onGround: true,
      dir: 1,
      speed: 2.0,
    };
    const wall = {
      aabb: Physics.makeAABB(2.5, 0, 0, 1.0, 2.0, 4.0), // minX = 2.0
      ref: { id: 'wall' },
    };
    const dt = 1 / 30;

    let flipped = false;
    for (let stepIndex = 0; stepIndex < 20; stepIndex++) {
      const stepResult = Physics.stepWalker(walker, dt, [wall]);
      if (stepResult.hitWallX) {
        flipped = true;
        assert.equal(walker.dir, -1, 'dir must flip from 1 to -1 on hitting wall');
        break;
      }
    }
    assert.equal(flipped, true, 'walker must hit wall and flip');
  });

  it('fireball bounces on floor landing and dies on hitting a wall', () => {
    const fireball = {
      x: 0,
      y: 1.0,
      z: 0,
      vx: 15.0,
      vy: -5.0,
      vz: 0,
      width: 0.5,
      height: 0.5,
      depth: 0.5,
      onGround: false,
      alive: true,
    };
    const floor = {
      aabb: Physics.makeAABB(10, -1.2, 0, 25, 1.2, 10),
      ref: { id: 'floor' },
    };
    const wall = {
      aabb: Physics.makeAABB(5.0, 0, 0, 1.0, 5.0, 5.0),
      ref: { id: 'wall' },
    };
    const dt = Config.FIXED_DT;

    // Test bounce on floor without wall
    let bounced = false;
    for (let stepIndex = 0; stepIndex < 60; stepIndex++) {
      const stepResult = Physics.stepFireball(fireball, dt, [floor]);
      if (stepResult.bounced) {
        bounced = true;
        assert.equal(fireball.vy, Config.FIREBALL_BOUNCE_VELOCITY);
        assert.equal(fireball.alive, true);
        break;
      }
    }
    assert.equal(bounced, true, 'fireball must bounce on floor');

    // Test death on wall
    fireball.x = 4.0;
    fireball.y = 0.5;
    fireball.vx = 15.0;
    let diedOnWall = false;
    for (let stepIndex = 0; stepIndex < 60; stepIndex++) {
      const stepResult = Physics.stepFireball(fireball, dt, [floor, wall]);
      if (stepResult.hitWall) {
        diedOnWall = true;
        assert.equal(stepResult.alive, false);
        assert.equal(fireball.alive, false);
        break;
      }
    }
    assert.equal(diedOnWall, true, 'fireball must die on wall hit');
  });
});
