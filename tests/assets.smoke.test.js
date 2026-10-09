/**
 * @fileoverview Node.js smoke tests for procedural textures and 3D models.
 * Runs in a fake_dom VM context. Asserts return types, cache identity,
 * Box3 bounds (15% tolerance), origin rules, and animation idempotence.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createContext, loadScripts } = require('./helpers/fake_dom.js');

describe('Assets Smoke Tests (Textures and Models)', () => {
  const context = createContext();
  loadScripts(context, [
    'vendor/three.min.js',
    'src/config.js',
    'src/textures.js',
    'src/models.js',
  ]);

  const THREE = context.THREE;
  const Textures = context.KUDLA.Textures;
  const Models = context.KUDLA.Models;
  const Config = context.KUDLA.Config;

  describe('Textures API (DESIGN.md 7.1)', () => {
    test('canvasTexture creates valid CanvasTexture with sRGB and anisotropy', () => {
      const texture = Textures.canvasTexture(128, 128, (ctx) => {
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(0, 0, 128, 128);
      }, { cacheKey: 'test_custom' });

      assert.ok(texture, 'Texture must be created');
      assert.strictEqual(texture.encoding, THREE.sRGBEncoding, 'Encoding must be sRGBEncoding');
      assert.strictEqual(texture.anisotropy, 4, 'Anisotropy must be 4');

      const repeatTexture = Textures.canvasTexture(128, 128, null, { cacheKey: 'test_custom' });
      assert.strictEqual(texture, repeatTexture, 'Same cacheKey must return identical instance');
    });

    test('Block faces return cached CanvasTextures', () => {
      const tile1 = Textures.tileBlock();
      const tile2 = Textures.tileBlock();
      assert.ok(tile1 && tile1.isCanvasTexture);
      assert.strictEqual(tile1, tile2, 'tileBlock must return cached instance');

      const mystery1 = Textures.mysteryBlock();
      const mystery2 = Textures.mysteryBlock();
      assert.ok(mystery1 && mystery1.isCanvasTexture);
      assert.strictEqual(mystery1, mystery2, 'mysteryBlock must return cached instance');

      const used1 = Textures.usedBlock();
      const used2 = Textures.usedBlock();
      assert.ok(used1 && used1.isCanvasTexture);
      assert.strictEqual(used1, used2, 'usedBlock must return cached instance');

      const laterite1 = Textures.laterite();
      const laterite2 = Textures.laterite();
      assert.ok(laterite1 && laterite1.isCanvasTexture);
      assert.strictEqual(laterite1, laterite2, 'laterite must return cached instance');
      assert.strictEqual(laterite1.wrapS, THREE.RepeatWrapping);
    });

    test('Environment textures return cached tileable textures', () => {
      const envFuncs = [
        'platformFloor', 'tactileStrip', 'ballast', 'wallPlaster',
        'canopyUnderside', 'roofTiles', 'boundaryWall', 'water',
      ];
      envFuncs.forEach((funcName) => {
        const tex1 = Textures[funcName]();
        const tex2 = Textures[funcName]();
        assert.ok(tex1 && tex1.isCanvasTexture, funcName + ' must return CanvasTexture');
        assert.strictEqual(tex1, tex2, funcName + ' must return cached instance');
        assert.strictEqual(tex1.wrapS, THREE.RepeatWrapping, funcName + ' must have RepeatWrapping');
        assert.strictEqual(tex1.wrapT, THREE.RepeatWrapping, funcName + ' must have RepeatWrapping');
      });
    });

    test('Signage textures return cached textures', () => {
      const station1 = Textures.stationNameBoard();
      const station2 = Textures.stationNameBoard();
      assert.ok(station1 && station1.isCanvasTexture);
      assert.strictEqual(station1, station2);

      const textBoard1 = Textures.textBoard(['PLATFORM 1', 'CHECKPOINT']);
      const textBoard2 = Textures.textBoard(['PLATFORM 1', 'CHECKPOINT']);
      assert.ok(textBoard1 && textBoard1.isCanvasTexture);
      assert.strictEqual(textBoard1, textBoard2);

      const led1 = Textures.ledBoard('12620 MATSYAGANDHA');
      const led2 = Textures.ledBoard('12620 MATSYAGANDHA');
      assert.ok(led1 && led1.isCanvasTexture);
      assert.strictEqual(led1, led2);
    });

    test('All 5 poster keys return cached textures', () => {
      const posterKeys = ['yakshagana', 'kambala', 'pilivesha', 'gadbad', 'panambur'];
      posterKeys.forEach((key) => {
        const poster1 = Textures.poster(key);
        const poster2 = Textures.poster(key);
        assert.ok(poster1 && poster1.isCanvasTexture, 'Poster ' + key + ' must return CanvasTexture');
        assert.strictEqual(poster1, poster2, 'Poster ' + key + ' must be cached');
      });
    });

    test('All 10 icons return cached HTMLCanvasElement instances (not textures)', () => {
      const iconNames = [
        'cashew', 'buns', 'gheeroast', 'gadbad', 'coconut',
        'denji', 'crow', 'tile', 'mystery', 'laterite',
      ];
      iconNames.forEach((name) => {
        const icon1 = Textures.icon(name);
        const icon2 = Textures.icon(name);
        assert.ok(icon1, 'Icon ' + name + ' must be returned');
        assert.strictEqual(icon1.width, 96, 'Icon width must be 96');
        assert.strictEqual(icon1.height, 96, 'Icon height must be 96');
        assert.strictEqual(icon1, icon2, 'Icon ' + name + ' must be cached');
      });
    });
  });

  describe('Models API (DESIGN.md 7.2 & 4)', () => {
    /**
     * Helper to assert bounding box sizes within 15% tolerance and bottom-centre origin.
     */
    function verifyBounds(object, expectedWidth, expectedHeight, expectedDepth, isCentred) {
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // 15% tolerance on dimensions
      const tolWidth = expectedWidth * 0.15;
      const tolHeight = expectedHeight * 0.15;
      const tolDepth = expectedDepth * 0.15;

      assert.ok(
        Math.abs(size.x - expectedWidth) <= tolWidth,
        'Width ' + size.x + ' outside 15% tolerance of ' + expectedWidth
      );
      assert.ok(
        Math.abs(size.y - expectedHeight) <= tolHeight,
        'Height ' + size.y + ' outside 15% tolerance of ' + expectedHeight
      );
      assert.ok(
        Math.abs(size.z - expectedDepth) <= tolDepth,
        'Depth ' + size.z + ' outside 15% tolerance of ' + expectedDepth
      );

      // Centred in X and Z
      assert.ok(Math.abs(center.x) < 0.08, 'Must be centred in X, got ' + center.x);
      assert.ok(Math.abs(center.z) < 0.08, 'Must be centred in Z, got ' + center.z);

      if (isCentred) {
        assert.ok(Math.abs(center.y) < 0.08, 'Block must be centred in Y, got ' + center.y);
      } else {
        assert.ok(Math.abs(box.min.y) < 0.08, 'Origin must be bottom-centre (min.y ~ 0), got ' + box.min.y);
      }
    }

    test('createBlock creates 1x1x1 centred block and setBlockKind swaps material', () => {
      const kinds = ['tile', 'mystery', 'used', 'laterite'];
      kinds.forEach((kind) => {
        const block = Models.createBlock(kind);
        assert.ok(block.isMesh);
        assert.strictEqual(block.userData.kind, 'block');
        assert.strictEqual(block.userData.blockKind, kind);
        assert.ok(block.castShadow);
        assert.ok(block.receiveShadow);
        verifyBounds(block, 1.0, 1.0, 1.0, true);
      });

      const block = Models.createBlock('tile');
      const tileMaterial = block.material;
      Models.setBlockKind(block, 'mystery');
      assert.notStrictEqual(block.material, tileMaterial, 'Material must swap');
      assert.strictEqual(block.userData.blockKind, 'mystery');
    });

    test('createCashew fits 0.6 cube with bottom-centre origin', () => {
      const cashew = Models.createCashew();
      assert.ok(cashew.isMesh);
      assert.strictEqual(cashew.userData.kind, 'cashew');
      verifyBounds(cashew, 0.6, 0.6, 0.6, false);
    });

    test('createItem items fit 0.8 cube with bottom-centre origin', () => {
      const types = ['buns', 'gheeroast', 'gadbad', 'coconut'];
      types.forEach((type) => {
        const item = Models.createItem(type);
        assert.strictEqual(item.userData.kind, 'item');
        assert.strictEqual(item.userData.itemType, type);
        verifyBounds(item, 0.8, 0.8, 0.8, false);
      });
    });

    test('createEnemy enemies match CRAB_SIZE, CROW_SIZE, CHIMNEY_CROW_SIZE', () => {
      const crab = Models.createEnemy('crab');
      assert.strictEqual(crab.userData.kind, 'enemy');
      assert.strictEqual(crab.userData.enemyType, 'crab');
      verifyBounds(crab, Config.CRAB_SIZE.w, Config.CRAB_SIZE.h, Config.CRAB_SIZE.d, false);

      const crow = Models.createEnemy('crow');
      assert.strictEqual(crow.userData.kind, 'enemy');
      assert.strictEqual(crow.userData.enemyType, 'crow');
      verifyBounds(crow, Config.CROW_SIZE.w, Config.CROW_SIZE.h, Config.CROW_SIZE.d, false);

      const chimneyCrow = Models.createEnemy('chimney_crow');
      assert.strictEqual(chimneyCrow.userData.kind, 'enemy');
      assert.strictEqual(chimneyCrow.userData.enemyType, 'chimney_crow');
      verifyBounds(chimneyCrow, Config.CHIMNEY_CROW_SIZE.w, Config.CHIMNEY_CROW_SIZE.h, Config.CHIMNEY_CROW_SIZE.d, false);
    });

    test('createFireball fits 0.5 cube with bottom-centre origin', () => {
      const fireball = Models.createFireball();
      assert.strictEqual(fireball.userData.kind, 'fireball');
      verifyBounds(fireball, Config.FIREBALL_SIZE, Config.FIREBALL_SIZE, Config.FIREBALL_SIZE, false);
    });

    test('createPlayer and setPlayerPower scale heights correctly', () => {
      const player = Models.createPlayer();
      assert.strictEqual(player.userData.kind, 'player');
      assert.strictEqual(player.userData.power, 'small');
      verifyBounds(player, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT_SMALL, Config.PLAYER_WIDTH, false);

      Models.setPlayerPower(player, 'big');
      assert.strictEqual(player.userData.power, 'big');
      verifyBounds(player, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT_BIG, Config.PLAYER_WIDTH, false);

      Models.setPlayerPower(player, 'fire');
      assert.strictEqual(player.userData.power, 'fire');
      verifyBounds(player, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT_BIG, Config.PLAYER_WIDTH, false);

      Models.setPlayerPower(player, 'small');
      assert.strictEqual(player.userData.power, 'small');
      verifyBounds(player, Config.PLAYER_WIDTH, Config.PLAYER_HEIGHT_SMALL, Config.PLAYER_WIDTH, false);
    });

    test('createShard returns small terracotta shard', () => {
      const shard = Models.createShard();
      assert.ok(shard.isMesh);
      assert.strictEqual(shard.userData.kind, 'shard');
    });

    test('createScorePopup creates configured Sprite with cached texture', () => {
      const popup1 = Models.createScorePopup('100');
      const popup2 = Models.createScorePopup('100');
      assert.ok(popup1.isSprite);
      assert.strictEqual(popup1.userData.kind, 'score_popup');
      assert.strictEqual(popup1.userData.text, '100');
      assert.strictEqual(popup1.material.depthTest, false);
      assert.strictEqual(popup1.material.transparent, true);
      assert.strictEqual(popup1.renderOrder, 999);
      assert.strictEqual(popup1.scale.x, 1.4);
      assert.strictEqual(popup1.scale.y, 0.52);
      assert.strictEqual(popup1.scale.z, 1);
      assert.strictEqual(popup1.material.map, popup2.material.map, 'Popup texture must be cached');
    });

    test('animate executes idempotently for all models and states without throwing', () => {
      const cashew = Models.createCashew();
      Models.animate(cashew, 1.0);
      assert.ok(cashew.rotation.y > 0);

      const block = Models.createBlock('tile');
      Models.animate(block, 0.1, 'bump');

      const buns = Models.createItem('buns');
      Models.animate(buns, 1.0);

      const gadbad = Models.createItem('gadbad');
      Models.animate(gadbad, 1.0);

      const fireball = Models.createFireball();
      Models.animate(fireball, 1.0);

      const crab = Models.createEnemy('crab');
      Models.animate(crab, 1.0, 'walk');
      Models.animate(crab, 1.0, 'squashed');
      assert.strictEqual(crab.scale.y, 0.3);
      Models.animate(crab, 1.0, 'dead');
      assert.strictEqual(crab.rotation.z, Math.PI);

      const crow = Models.createEnemy('crow');
      Models.animate(crow, 1.0, 'fly');
      Models.animate(crow, 1.0, 'dead');
      assert.strictEqual(crow.rotation.x, Math.PI);

      const player = Models.createPlayer();
      Models.animate(player, 1.0, 'idle', 0);
      Models.animate(player, 1.0, 'run', 8);
      Models.animate(player, 1.0, 'jump', 0);
    });
  });
});
