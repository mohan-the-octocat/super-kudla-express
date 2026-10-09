/**
 * @fileoverview Node.js smoke tests for KUDLA.Scenery module.
 * Runs in a fake_dom VM context. Asserts contract return shapes, draw call budget (< 650),
 * 150s simulation loop (horn triggers >= 2, rumble in [0, 1], no NaN positions, no throw).
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createContext, loadScripts } = require('./helpers/fake_dom.js');

describe('Scenery Smoke Tests (DESIGN.md §7.3)', () => {
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
  ]);

  const THREE = context.THREE;
  const Config = context.KUDLA.Config;
  const Level = context.KUDLA.Level;
  const Scenery = context.KUDLA.Scenery;

  test('Scenery.build returns expected contract shape and attaches objects to scene', () => {
    const level = Level.create();
    const scene = new THREE.Scene();
    const scenery = Scenery.build(scene, level);

    assert.ok(scenery, 'Scenery.build must return an object');

    // Sun directional light
    assert.ok(scenery.sun && scenery.sun.isDirectionalLight, 'sun must be a DirectionalLight');
    assert.strictEqual(scenery.sun.castShadow, true, 'sun must have castShadow = true');
    assert.ok(scenery.sun.target, 'sun must have a target');
    assert.ok(scene.children.includes(scenery.sun) || scenery.sun.parent, 'sun must be added to scene');
    assert.ok(scene.children.includes(scenery.sun.target) || scenery.sun.target.parent, 'sun target must be in scene');

    // Standing train
    assert.ok(scenery.standingTrain && scenery.standingTrain.isGroup, 'standingTrain must be a Group');
    assert.strictEqual(scenery.standingTrain.position.x, level.train.rearX, 'standingTrain.position.x must match rearX');
    assert.strictEqual(scenery.standingTrain.position.y, Config.GEOMETRY.RAIL_TOP_Y, 'standingTrain.position.y must match RAIL_TOP_Y');
    assert.strictEqual(scenery.standingTrain.position.z, level.train.z, 'standingTrain.position.z must match level.train.z');
    assert.ok(scene.children.includes(scenery.standingTrain) || scenery.standingTrain.parent, 'standingTrain must be added to scene');

    // Flag pole
    assert.ok(scenery.flagPole && scenery.flagPole.isGroup, 'flagPole must be a Group');
    assert.ok(scenery.flagPole.userData.flag, 'flagPole.userData.flag must exist');
    assert.strictEqual(scenery.flagPole.userData.height, 11, 'flagPole.userData.height must be 11');
    assert.ok(scene.children.includes(scenery.flagPole) || scenery.flagPole.parent, 'flagPole must be added to scene');

    // Update function
    assert.strictEqual(typeof scenery.update, 'function', 'update must be a function');
  });

  test('Draw call count is below budget (< 650)', () => {
    const level = Level.create();
    const scene = new THREE.Scene();
    Scenery.build(scene, level);

    let drawCalls = 0;
    scene.traverse((node) => {
      if (node.isMesh || node.isInstancedMesh || node.isSprite || node.isLine || node.isLineSegments) {
        drawCalls++;
      }
    });

    assert.ok(drawCalls > 0, 'Scene must contain renderable objects');
    assert.ok(drawCalls < 650, `Draw calls count ${drawCalls} exceeds 650 limit`);
  });

  test('150s update simulation: horn >= 2, rumble in [0, 1], no NaN positions, no throw', () => {
    const level = Level.create();
    const scene = new THREE.Scene();
    const scenery = Scenery.build(scene, level);

    const stepDelta = 1 / 60;
    const totalDuration = 150;
    const totalSteps = Math.round(totalDuration / stepDelta);

    let hornCount = 0;
    const playerPos = { x: 0, y: 0, z: 0 };

    for (let stepIndex = 0; stepIndex <= totalSteps; stepIndex++) {
      const currentTime = stepIndex * stepDelta;
      playerPos.x = (currentTime / totalDuration) * 220;

      const result = scenery.update(stepDelta, currentTime, playerPos);
      assert.ok(result, 'update must return an object');

      if (result.horn) {
        hornCount++;
      }

      assert.ok(
        typeof result.rumble === 'number' && result.rumble >= 0 && result.rumble <= 1,
        `rumble must be within [0, 1], got ${result.rumble} at time ${currentTime}`
      );
    }

    assert.ok(hornCount >= 2, `horn must trigger at least twice during 150s, got ${hornCount}`);

    // Verify no NaN positions in entire scene graph
    scene.traverse((node) => {
      assert.ok(!Number.isNaN(node.position.x), `node.position.x is NaN on ${node.name || 'unnamed'}`);
      assert.ok(!Number.isNaN(node.position.y), `node.position.y is NaN on ${node.name || 'unnamed'}`);
      assert.ok(!Number.isNaN(node.position.z), `node.position.z is NaN on ${node.name || 'unnamed'}`);
    });
  });
});
