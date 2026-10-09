/**
 * @fileoverview Test suite for level data blueprint and invariants (DESIGN.md §5, §5.1, §5.2).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const Config = require('../src/config.js');
const Physics = require('../src/physics.js');
const Level = require('../src/level.js');

describe('KUDLA.Level', () => {
  it('returns a fresh deep object on every call to create()', () => {
    const level1 = Level.create();
    const level2 = Level.create();
    assert.notEqual(level1, level2);
    assert.notEqual(level1.playerStart, level2.playerStart);
    assert.notEqual(level1.solids, level2.solids);
    assert.notEqual(level1.solids[0], level2.solids[0]);
    assert.notEqual(level1.blocks, level2.blocks);
    assert.notEqual(level1.cashews, level2.cashews);
    assert.notEqual(level1.enemies, level2.enemies);
    assert.notEqual(level1.decor, level2.decor);
  });

  it('guarantees unique IDs across the entire level', () => {
    const level = Level.create();
    const seenIds = new Set();

    const collections = [
      level.sections,
      level.pits,
      level.solids,
      level.blocks,
      level.cashews,
      level.enemies,
      level.decor,
    ];

    let totalElements = 0;
    for (let cIndex = 0; cIndex < collections.length; cIndex++) {
      const collection = collections[cIndex];
      for (let itemIndex = 0; itemIndex < collection.length; itemIndex++) {
        const item = collection[itemIndex];
        assert.ok(item.id, `item must have an id: ${JSON.stringify(item)}`);
        assert.equal(typeof item.id, 'string');
        assert.equal(seenIds.has(item.id), false, `duplicate ID found: ${item.id}`);
        seenIds.add(item.id);
        totalElements++;
      }
    }
    assert.equal(seenIds.size, totalElements);
  });

  it('contains only permitted kinds, contents, enemy types, and decor types', () => {
    const level = Level.create();
    const allowedSolidKinds = new Set([
      'platform', 'barrier', 'laterite', 'chimney', 'pillar', 'bench', 'stall', 'npc',
    ]);
    const allowedBlockKinds = new Set(['tile', 'mystery', 'hidden']);
    const allowedBlockContents = new Set(['none', 'cashew', 'multi', 'powerup', 'star', 'oneup']);
    const allowedEnemyTypes = new Set(['crab', 'crow', 'chimney_crow']);
    const allowedDecorTypes = new Set([
      'overheadBoard', 'ledBoard', 'wallBoard', 'farBoard', 'poster',
      'clock', 'sign', 'signal', 'dustbin', 'waterTap',
    ]);

    for (let index = 0; index < level.solids.length; index++) {
      const solid = level.solids[index];
      assert.ok(allowedSolidKinds.has(solid.kind), `unknown solid kind: ${solid.kind}`);
    }

    for (let index = 0; index < level.blocks.length; index++) {
      const block = level.blocks[index];
      assert.ok(allowedBlockKinds.has(block.kind), `unknown block kind: ${block.kind}`);
      assert.ok(allowedBlockContents.has(block.contents), `unknown block contents: ${block.contents}`);
    }

    for (let index = 0; index < level.enemies.length; index++) {
      const enemy = level.enemies[index];
      assert.ok(allowedEnemyTypes.has(enemy.type), `unknown enemy type: ${enemy.type}`);
      assert.ok(enemy.dir === -1 || enemy.dir === 1, `enemy dir must be -1 or 1`);
      if (enemy.type === 'chimney_crow') {
        assert.ok(enemy.chimneyId, `chimney_crow must have chimneyId`);
      } else {
        assert.equal(enemy.chimneyId, undefined, `chimneyId should only exist for chimney_crow`);
      }
    }

    for (let index = 0; index < level.decor.length; index++) {
      const decorItem = level.decor[index];
      assert.ok(allowedDecorTypes.has(decorItem.type), `unknown decor type: ${decorItem.type}`);
    }
  });

  it('ensures no block intersects any solid or another block', () => {
    const level = Level.create();
    const blockAABBs = [];

    for (let index = 0; index < level.blocks.length; index++) {
      const block = level.blocks[index];
      const box = {
        x: block.x,
        y: block.y,
        z: block.z,
        w: Config.BLOCK,
        h: Config.BLOCK,
        d: Config.BLOCK,
      };
      blockAABBs.push({ aabb: Physics.boxToAABB(box), ref: block });
    }

    // Check against solids
    for (let bIndex = 0; bIndex < blockAABBs.length; bIndex++) {
      const blockItem = blockAABBs[bIndex];
      for (let sIndex = 0; sIndex < level.solids.length; sIndex++) {
        const solid = level.solids[sIndex];
        const solidAABB = Physics.boxToAABB(solid);
        const hasOverlap = Physics.intersects(blockItem.aabb, solidAABB);
        assert.equal(
          hasOverlap,
          false,
          `block ${blockItem.ref.id} intersects solid ${solid.id}`
        );
      }
    }

    // Check against other blocks
    for (let i = 0; i < blockAABBs.length; i++) {
      for (let j = i + 1; j < blockAABBs.length; j++) {
        const hasOverlap = Physics.intersects(blockAABBs[i].aabb, blockAABBs[j].aabb);
        assert.equal(
          hasOverlap,
          false,
          `block ${blockAABBs[i].ref.id} intersects block ${blockAABBs[j].ref.id}`
        );
      }
    }
  });

  it('ensures no cashew intersects any solid or any block', () => {
    const level = Level.create();
    const cashewSize = Config.CASHEW_SIZE;

    for (let cIndex = 0; cIndex < level.cashews.length; cIndex++) {
      const cashew = level.cashews[cIndex];
      const cashewAABB = Physics.boxToAABB({
        x: cashew.x,
        y: cashew.y,
        z: cashew.z,
        w: cashewSize,
        h: cashewSize,
        d: cashewSize,
      });

      // Against solids
      for (let sIndex = 0; sIndex < level.solids.length; sIndex++) {
        const solid = level.solids[sIndex];
        const solidAABB = Physics.boxToAABB(solid);
        const hasOverlap = Physics.intersects(cashewAABB, solidAABB);
        assert.equal(
          hasOverlap,
          false,
          `cashew ${cashew.id} intersects solid ${solid.id}`
        );
      }

      // Against blocks
      for (let bIndex = 0; bIndex < level.blocks.length; bIndex++) {
        const block = level.blocks[bIndex];
        const blockAABB = Physics.boxToAABB({
          x: block.x,
          y: block.y,
          z: block.z,
          w: Config.BLOCK,
          h: Config.BLOCK,
          d: Config.BLOCK,
        });
        const hasOverlap = Physics.intersects(cashewAABB, blockAABB);
        assert.equal(
          hasOverlap,
          false,
          `cashew ${cashew.id} intersects block ${block.id}`
        );
      }
    }
  });

  it('matches floor platform spans and pit gaps exactly per blueprint', () => {
    const level = Level.create();

    const expectedPits = [
      { id: 'pit-a', x0: 70, x1: 74 },
      { id: 'pit-b', x0: 138, x1: 142.5 },
      { id: 'pit-c', x0: 169.5, x1: 173.5 },
      { id: 'pit-d', x0: 186, x1: 191.5 },
    ];
    assert.equal(level.pits.length, 4);
    for (let index = 0; index < expectedPits.length; index++) {
      assert.equal(level.pits[index].id, expectedPits[index].id);
      assert.equal(level.pits[index].x0, expectedPits[index].x0);
      assert.equal(level.pits[index].x1, expectedPits[index].x1);
    }

    const platformSolids = level.solids.filter((item) => item.kind === 'platform');
    assert.equal(platformSolids.length, 5);

    const expectedSpans = [
      [-6, 70],
      [74, 138],
      [142.5, 169.5],
      [173.5, 186],
      [191.5, 240],
    ];
    for (let index = 0; index < expectedSpans.length; index++) {
      const solid = platformSolids[index];
      const minX = solid.x - solid.w / 2;
      const maxX = solid.x + solid.w / 2;
      assert.ok(Math.abs(minX - expectedSpans[index][0]) < 0.001);
      assert.ok(Math.abs(maxX - expectedSpans[index][1]) < 0.001);
      assert.equal(solid.y, -1.2);
      assert.equal(solid.h, 1.2);
    }
  });

  it('guarantees every pit is at most 5.5 m wide', () => {
    const level = Level.create();
    for (let index = 0; index < level.pits.length; index++) {
      const pit = level.pits[index];
      const width = pit.x1 - pit.x0;
      assert.ok(
        width <= 5.5 + 0.0001,
        `pit ${pit.id} width (${width}) must be <= 5.5 m`
      );
    }
  });

  it('clears every pit in a simulated run-and-jump', () => {
    const level = Level.create();
    const colliders = Level.staticColliders(level);
    const dt = Config.FIXED_DT;

    for (let pIndex = 0; pIndex < level.pits.length; pIndex++) {
      const pit = level.pits[pIndex];
      let startX;
      let startY;
      let jumpX;

      if (pit.id === 'pit-c') {
        // Pit C starts on top column (x = 169, spans 168.5 to 169.5, top y = 4.0)
        startX = 168.6;
        startY = 4.0;
        jumpX = 169.5 - 0.3; // 169.2
      } else {
        startX = pit.x0 - 8.0;
        startY = 0.0;
        jumpX = pit.x0 - 0.3;
      }

      const player = {
        x: startX,
        y: startY,
        z: 1.5,
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

      let jumpPressed = false;
      let cleared = false;

      for (let stepIndex = 0; stepIndex < 500; stepIndex++) {
        const pressJumpNow = !jumpPressed && player.x >= jumpX;
        if (pressJumpNow) {
          jumpPressed = true;
        }

        const input = {
          moveX: 1,
          moveZ: 0,
          run: true,
          jumpPressed: pressJumpNow,
          jumpHeld: jumpPressed,
        };

        Physics.updatePlayerMotion(player, input, dt);
        Physics.stepBody(player, dt, colliders);

        // Verify player does not fall below floor level while inside the pit span
        if (player.x >= pit.x0 && player.x <= pit.x1) {
          assert.ok(
            player.y > 0,
            `player fell into pit ${pit.id} at x=${player.x.toFixed(2)}, y=${player.y.toFixed(2)}`
          );
        }

        // Successfully landed on the other side of the pit
        if (player.x >= pit.x1 && player.onGround && player.y >= -0.01) {
          cleared = true;
          break;
        }

        if (player.y < Config.KILL_Y) {
          break;
        }
      }

      assert.equal(
        cleared,
        true,
        `failed to clear pit ${pit.id} (final x=${player.x.toFixed(2)}, y=${player.y.toFixed(2)})`
      );
    }
  });

  it('guarantees every block bottom sits at least 2.9 m above the floor below it', () => {
    const level = Level.create();
    for (let index = 0; index < level.blocks.length; index++) {
      const block = level.blocks[index];
      const floorTop = Level.floorTopAt(level, block.x, block.z);
      assert.ok(floorTop !== null, `block ${block.id} at (${block.x}, ${block.z}) is over a pit`);
      const clearance = block.y - floorTop;
      assert.ok(
        clearance >= 2.9 - 0.001,
        `block ${block.id} clearance (${clearance.toFixed(2)}) must be >= 2.9 m`
      );
    }
  });

  it('guarantees adjacent laterite columns differ in height by at most 1.0 m', () => {
    const level = Level.create();
    const columns = level.solids
      .filter((solid) => solid.kind === 'laterite')
      .sort((colA, colB) => colA.x - colB.x);

    for (let i = 0; i < columns.length; i++) {
      for (let j = i + 1; j < columns.length; j++) {
        if (Math.abs(columns[i].x - columns[j].x) === 1) {
          const heightDiff = Math.abs(columns[i].h - columns[j].h);
          assert.ok(
            heightDiff <= 1.0 + 0.0001,
            `adjacent laterite columns at x=${columns[i].x} (h=${columns[i].h}) and x=${columns[j].x} (h=${columns[j].h}) differ by ${heightDiff} m`
          );
        }
      }
    }
  });

  it('guarantees playerStart, checkpoint, and every crab stand on floor', () => {
    const level = Level.create();

    const startFloor = Level.floorTopAt(level, level.playerStart.x, level.playerStart.z);
    assert.ok(startFloor !== null, 'playerStart must be above floor');
    assert.ok(Math.abs(level.playerStart.y - startFloor) < 0.001, 'playerStart must rest on floor');

    const cpFloor = Level.floorTopAt(level, level.checkpoint.x, level.checkpoint.z);
    assert.ok(cpFloor !== null, 'checkpoint must be above floor');

    for (let index = 0; index < level.enemies.length; index++) {
      const enemy = level.enemies[index];
      if (enemy.type === 'crab') {
        const crabFloor = Level.floorTopAt(level, enemy.x, enemy.z);
        assert.ok(crabFloor !== null, `crab ${enemy.id} at (${enemy.x}, ${enemy.z}) is over a pit`);
        assert.ok(
          Math.abs(enemy.y - crabFloor) < 0.001,
          `crab ${enemy.id} y (${enemy.y}) does not match floorTop (${crabFloor})`
        );
      }
    }
  });

  it('guarantees all crows spawn at y >= 2.0', () => {
    const level = Level.create();
    for (let index = 0; index < level.enemies.length; index++) {
      const enemy = level.enemies[index];
      if (enemy.type === 'crow' || enemy.type === 'chimney_crow') {
        assert.ok(
          enemy.y >= 2.0 - 0.001,
          `crow ${enemy.id} spawns at y=${enemy.y}, expected >= 2.0`
        );
      }
    }
  });

  it('guarantees flag.x < train.doorX < LEVEL_END_X', () => {
    const level = Level.create();
    const endX = Config.GEOMETRY.LEVEL_END_X;
    assert.ok(
      level.flag.x < level.train.doorX,
      `flag.x (${level.flag.x}) must be < train.doorX (${level.train.doorX})`
    );
    assert.ok(
      level.train.doorX < endX,
      `train.doorX (${level.train.doorX}) must be < LEVEL_END_X (${endX})`
    );
  });
});
