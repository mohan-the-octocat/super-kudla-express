# Super Kudla Express: design and module contract

Single source of truth for every contributor. If this file conflicts with your
intuition, this file wins. Never rename anything defined here. Tuning numbers
live in `src/config.js` (`KUDLA.Config`); never hard-code a value that exists
there.

## 1. Pitch

A first-person 3D platformer in the spirit of Super Mario Bros. 1-1, set on
Platform 1 of Mangaluru Central (MAQ). ಕುಡ್ಲ (Kudla) is Mangaluru's Tulu name.
Run the length of the platform and pass the guard's green flag before **12620
Matsyagandha Express** (Mangaluru Central to Lokmanya Tilak Terminus, Mumbai)
departs. 240-second clock, 3 lives, golden cashews as coins, Mangalore snacks
as power-ups, Mangalore tile blocks as bricks. V toggles a third-person camera.

Theme map: brick = Mangalore Tile Block · `?` block = Goli Baje Block (shows
`?` and Tulu `ದಾದ?`, "what?") · used block = dark laterite · hard/stair block =
laterite stone (kempu kallu) · pipe = tile-kiln chimney · coin = golden cashew ·
mushroom = Mangalore Buns · fire flower = Ghee Roast (throw chillies) · star =
Gadbad ice cream · 1-up = tender coconut (bonda) · Goomba = Denji (ದೆಂಜಿ, crab) ·
Paratroopa = station crow · Piranha plant = chimney crow · flagpole = guard's
green flag · castle = the train.

## 2. Controls

| Action | Keyboard / mouse | Gamepad (standard mapping, optional) |
| --- | --- | --- |
| Move | WASD or arrow keys | Left stick |
| Look | Mouse (pointer lock; click the game to lock) | Right stick |
| Jump (hold = higher) | Space | A (0) |
| Run | Shift (hold) | X (2) held |
| Throw chilli (Ghee Roast only) | F or left click | B (1) |
| Camera first/third person | V | Y (3) |
| Mute | M | |
| Pause | Esc or P | Start (9) |
| Confirm on screens | Enter | A |

## 3. Engineering rules (every file)

1. Plain browser JavaScript in classic `<script>` tags. No ES modules, bundler,
   or npm runtime dependency. Three.js r149 UMD is the global `THREE` from
   `vendor/three.min.js`. The game must run from `file://` (double-click
   `index.html`) and from `http://`.
2. Runtime needs no network. All art is procedural (Canvas 2D to
   `THREE.CanvasTexture`) or embedded data URIs (`assets/posters.js`). The only
   optional network use is the Google Fonts `<link>` in `index.html`; fallback
   fonts must still look good.
3. Module wrapper, exactly this shape:

   ```js
   (function (root) {
     'use strict';
     const KUDLA = (root.KUDLA = root.KUDLA || {});
     // ... module body ...
     KUDLA.Physics = Physics;
     if (typeof module === 'object' && module.exports) {
       module.exports = Physics;
     }
   })(typeof window !== 'undefined' ? window : globalThis);
   ```

   Read other modules (`KUDLA.Textures`, `KUDLA.Models`, ...) at call time, not
   at file-load time. `KUDLA.Config` is always loaded first.
4. Script order in `index.html`: `vendor/three.min.js`, `assets/posters.js`,
   `src/config.js`, `src/level.js`, `src/physics.js`, `src/textures.js`,
   `src/models.js`, `src/scenery.js`, `src/audio.js`, `src/input.js`,
   `src/hud.js`, `src/game.js`, `src/main.js`.
5. Quality bar: `'use strict'`; JSDoc on every public function; no
   `console.log` (`console.warn` only for genuine fallbacks); no TODOs, stubs,
   or placeholder art; cache and share geometries, materials, and textures;
   avoid per-frame allocations in hot paths; optional data (for example
   `KUDLA.POSTERS`) may be missing and must never throw. Two-space indent,
   semicolons, `const`/`let` only, no single-letter names except `i`, `j`, `k`,
   `x`, `y`, `z`, `e`.
6. Three.js r149 specifics: `renderer.outputEncoding = THREE.sRGBEncoding`;
   colour textures set `texture.encoding = THREE.sRGBEncoding`; `BufferGeometry`
   only; `THREE.CapsuleGeometry` exists; use `THREE.InstancedMesh` for anything
   repeated more than 50 times (sleepers, ballast stones, palm parts, ...).
7. Tests use Node 22 built-ins only (`node:test`, `node:assert/strict`,
   `node:vm`). Run all with `npm test` (`node --test`). Browser modules are smoke
   tested inside a `vm` context built by `tests/helpers/fake_dom.js` (§7.4).
8. Visual check without a system browser: a Chrome headless shell is at
   `/usr/local/google/home/mohansridharan/.gemini/jetski/scratch/tools/chrome-headless-shell-linux64/chrome-headless-shell`.
   Screenshot a page with:
   `<shell> --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --window-size=1280,720 --virtual-time-budget=6000 --screenshot=<out.png> file://<absolute path to page>`.
   Downscale before viewing: `convert <out.png> -resize 1000x -quality 70 <out.jpg>`.

## 4. World conventions

- Units are metres and seconds. +X runs along Platform 1 toward the train; +Y
  is up; +Z points toward the tracks (the player's right when facing +X). The
  platform top is y = 0.
- Cross-section (`Config.GEOMETRY`): building wall at z = -4.0; playable
  platform z in [-4.0, 3.6] (invisible barrier at 3.6); tactile strip z in
  [2.6, 3.0]; coping/edge at z = 4.0; Track 1 centre z = 6.0 (the standing
  Matsyagandha); Track 2 centre z = 11.0 (passing goods trains); boundary wall
  z = 14.5; rail top y = -0.9; ballast top y = -1.2; canopy underside y = 8.0;
  building wall height 6.0; pit water y = -3.0.
- Yaw and pitch: yaw = 0 looks along +X; forward = (cos yaw, 0, sin yaw);
  right = (-sin yaw, 0, cos yaw); moving the mouse right increases yaw. Camera:
  `rotation.order = 'YXZ'`, `rotation.y = -(yaw + Math.PI / 2)`,
  `rotation.x = pitch` (positive looks up), |pitch| <= `CAMERA.PITCH_LIMIT`.
- Boxes in level data are `{x, y, z, w, h, d}`: x and z are the centre, y is
  the bottom; w spans X, h spans Y, d spans Z.
- Origin rule: every dynamic model's local origin is the bottom-centre of its
  gameplay AABB, so `object.position.set(body.x, body.y, body.z)` is correct.
  The only exception is `Models.createBlock`, which is centred (position it at
  `(x, y + BLOCK / 2, z)`).
- Facing rule: every model and decor object faces local +Z; `rotY` (or
  `rotation.y`) turns it. Facing -X is `rotY = -Math.PI / 2`; facing -Z is
  `rotY = Math.PI`.

## 5. Level data: `src/level.js`

`KUDLA.Level = {create, staticColliders, floorTopAt}`.

- `create()` returns a fresh deep object every call (callers mutate it):

  ```text
  {
    name: 'Mangaluru Central — Platform 1',
    playerStart: {x, y, z, yaw},
    checkpoint: {x, z},
    flag: {x, z, height},
    train: {rearX, z, cars, doorX},
    sections: [{id, x0, x1, canopy, label}],
    pits: [{id, x0, x1}],
    solids: [{id, kind, x, y, z, w, h, d, props}],
    blocks: [{id, kind, contents, x, y, z}],
    cashews: [{id, x, y, z}],
    enemies: [{id, type, x, y, z, dir, chimneyId}],
    decor: [{id, type, x, y, z, rotY, props}],
  }
  ```

  Solid kinds: `platform | barrier | laterite | chimney | pillar | bench |
  stall | npc`. Block kinds: `tile | mystery | hidden`; contents: `none |
  cashew | multi | powerup | star | oneup`; each block is one BLOCK cube (x, z
  centre; y bottom). Cashews are `CASHEW_SIZE` cubes (bottom-centre). Enemy
  types: `crab | crow | chimney_crow`; `dir` is -1 or 1 along X; `chimneyId`
  is set only for `chimney_crow`. Every id is unique across the whole level.
- `staticColliders(level)` returns `[{aabb, ref}]` for every solid, barriers
  included (`ref` is the solid object).
- `floorTopAt(level, x, z)` returns the top y of the highest `platform` or
  `laterite` solid whose footprint contains (x, z), or `null` over a pit.

### 5.1 Layout blueprint (implement exactly)

Block codes: T = tile/none, C = mystery/cashew, P = mystery/powerup, S =
tile/star, M = tile/multi, U = hidden/oneup. A row lists block centres at x0,
x0 + 1, ... Blocks use y = 3.0 and z = 0 unless stated.

- Sections: `booking` [-6, 32] canopy 'Booking Hall'; `kiln` [32, 78] open
  'Tile Kiln Yard'; `drain` [78, 112] canopy 'Monsoon Drain'; `tea` [112, 150]
  canopy 'Tea & Tiles'; `steps` [150, 200] open 'Laterite Steps'; `flag`
  [200, 240] open "Guard's Flag".
- Floor (`platform`, y -1.2, h 1.2, z centre 0, d 8): x spans [-6, 70],
  [74, 138], [142.5, 169.5], [173.5, 186], [191.5, 240]. Pits are the gaps: A
  [70, 74], B [138, 142.5], C [169.5, 173.5], D [186, 191.5].
- Barriers (`barrier`, invisible, y -10 to 30): back z [-4.5, -4.0] and edge z
  [3.6, 4.1], both over x [-6.5, 240.5]; start x [-6.5, -6] and end x
  [240, 240.5], both over z [-4.5, 4.1]. Canopy lids (`barrier`) y [8.0, 8.5],
  z [-4.0, 4.0] over each canopy section.
- Pillars (`pillar`, w 0.5, h 8.0, d 0.5, z -2.2): x 0, 10, 20, 30, 80, 90,
  100, 110, 120, 130.
- Benches (`bench`, w 2.2, h 0.5, d 0.7, z -3.3): x 8, 30, 92, 104, 134, 230.
- Stalls (`stall`, w 3.0, h 2.6, d 1.4, z -3.3): x 24 with props `{name: 'KUDLA
  TEA STALL', menu: ['Goli Baje', 'Buns', 'Neer Dosa', 'Kaapi / Chai']}`; x 116
  with props `{name: 'GADBAD CORNER', menu: ['Gadbad', 'Parfait', 'Kulfi',
  'Fresh Juice']}`.
- NPCs (`npc`, w 0.6, h 1.7, d 0.6, props.variant): porter (4, z -3.3); saree
  (13, -3.3); mundu (28, -3.3); mundu (98, -3.3); saree (122, -3.3); guard
  (219.5, 2.2).
- Chimneys (`chimney`, w 1.8, d 1.8, z 0, y 0): x 36 h 2.0; x 45 h 3.0; x 54 h
  4.0; x 63 h 3.0.
- Laterite columns (`laterite`, w 1, d 7.6 spanning z -4.0 to 3.6 so z centre
  -0.2, y 0, h = height): pyramid 1 x 152-155 h 1, 2, 3, 4 then x 156-159 h 4,
  3, 2, 1. Pyramid 2 x 165-168 h 1, 2, 3, 4; x 169 h 4; pit C; x 174 h 4; x
  175-177 h 3, 2, 1. Final stair x 203-210 h 1-8; x 211 h 8.
- Blocks: C at 12; row x 17 `TPTCT`; U at 66.5; row x 79 `TCT`; 3x3 grid x
  86-88 by z -1, 0, 1, all T except (87, z 0) = P; M at 106; row x 117 z 0.5
  `TSTT`; row x 126 z -2.0 `CTC`; U at 147; row x 161 `TPT`; row x 195 z 1.0
  `CTC`.
- Free cashews (x, y, z): (6, 0.3, -1), (6, 0.3, 0), (6, 0.3, 1); x 38.5-42.5
  step 1 at y 1.0 z 0; chimney tops (36, 2.4, 0), (45, 3.4, 0), (63, 3.4, 0);
  pit A arc x 70.5, 71.25, 72, 72.75, 73.5 with y 1.2, 2.0, 2.4, 2.0, 1.2;
  diagonal x 110-115 step 1 with z -3, -2, -1, 0, 1, 2 at y 0.3; pit B arc x
  138.5-142 step 0.875 with y 1.2, 2.0, 2.4, 2.0, 1.2; pit C arc x 170-173 step
  0.75 with y 5.2, 6.0, 6.4, 6.0, 5.2; pit D arc x 186.5-191 step 0.9 with y
  1.2, 2.2, 2.8, 2.8, 2.2, 1.2; one above each final-stair column x 203-210 at
  y = column height + 0.4. All free cashews use z 0 unless stated.
- Enemies (dir -1, crabs y 0), given as (x, z): crab (27, 0); crab (41, 1.0);
  crab (49.5, -1.0); crab (50.7, -1.0); crab (59, 1.5); chimney_crow on the
  chimneys at x 54 and x 63 (x, z of the chimney; y = chimney top); crow (95,
  0) at y 2.8; crab (100, 0); crab (102, -1.2); crab (124, 0.5); crab (130.5,
  -1); crab (131.7, -1); crow (146, 1.0) at y 2.8; crab (162, 0); crab (163.2,
  1.0); crow (182, 0) at y 3.0; crab (198, -1); crab (199.2, -1).
- Specials: playerStart (2, 0, 0, yaw 0); checkpoint (112, 0); flag (218, 0,
  height 11); train `{rearX: 222, z: 6.0, cars: 8, doorX: 225.5}`.
- Decor (wall items at z -3.95 facing +Z, rotY 0 unless stated):
  - `overheadBoard` (7, y 5.2, z 0, rotY -PI/2) props.lines `['PLATFORM 1',
    '12620 MATSYAGANDHA EXP → MUMBAI LTT']`.
  - `ledBoard` (196, y 5.6, z 0, rotY -PI/2) props.text `'12620 MATSYAGANDHA
    EXPRESS  •  PLATFORM 1  •  RIGHT TIME'`.
  - `wallBoard` (station name board) at x 10, 90, 170, 214.
  - `farBoard` (station name board on the boundary wall, z 14.4, rotY PI) at x
    30 and 130.
  - `poster` props.key at x 3 yakshagana, 17 kambala, 47 pilivesha, 66 gadbad,
    96 panambur, 133 yakshagana, 162 kambala, 190 pilivesha, 228 gadbad.
  - `clock` at (12, y 5.4) and (120, y 5.4).
  - `sign` props `{lines, style}`: x 68.5 `['CAUTION', 'MONSOON DRAIN — MIND
    THE GAP']` caution; x 136.5 same; x 184.5 `['RUN!', 'HOLD SHIFT FOR A
    LONGER JUMP']` run; x 112 `['CHECKPOINT', 'HALFWAY DOWN PLATFORM 1']` info.
  - `signal` (232, y 0, z 8.5): colour-light signal showing green.
  - `dustbin` (z -3.6) at x 15, 58, 103, 145, 226.
  - `waterTap` (34, z -3.5) props.label `'DRINKING WATER'`.

### 5.2 `tests/level.test.js` must prove

Unique ids; only the kinds, contents, types, and decor types listed above; no
block intersects a solid or another block; no cashew intersects a solid or a
block; floor segments and pits match the blueprint; every pit is at most 5.5 m
wide; a simulated run-and-jump (`Physics.updatePlayerMotion` plus
`Physics.stepBody` with `staticColliders`) clears each pit (start from rest 8 m
before the edge, or on the top column for pit C, and press jump 0.3 m before
the edge); every block bottom sits at least 2.9 m above the floor below it;
adjacent laterite columns differ by at most 1.0 m; playerStart, checkpoint, and
every crab stand on floor; crows spawn at y >= 2; flag.x < train.doorX <
LEVEL_END_X.

## 6. Physics: `src/physics.js`

Pure functions, no THREE. AABB = `{minX, minY, minZ, maxX, maxY, maxZ}`.

- `makeAABB(x, y, z, w, h, d)` (x, z centre; y bottom); `boxToAABB(box)`;
  `bodyAABB(body)` (body `{x, y, z, width, height, depth}`; depth defaults to
  width); `intersects(a, b)` (strict overlap greater than
  `COLLISION_EPSILON` on all axes).
- `stepBody(body, dt, colliders, options)`: body `{x, y, z, vx, vy, vz, width,
  height, depth, onGround}`; colliders `[{aabb, ref}]`; options `{gravity,
  maxFall}` default to Config. Order: `vy = max(vy - gravity * dt, -maxFall)`,
  then move X and resolve, move Z and resolve, move Y and resolve. Per axis,
  resolve only colliders the body did not already overlap before that axis
  move (prevents snapping out of geometry), push out to the contact face
  (plus epsilon) and zero that velocity component. Returns `{onGround,
  landedOn, hitHead, hitWallX, hitWallZ, wallRefs}`; `hitHead` is the ref
  whose XZ overlap area with the body footprint is largest among colliders hit
  while moving up; sets `body.onGround`.
- `updatePlayerMotion(player, input, dt)`: call before `stepBody` each fixed
  step. `player` = body plus `{coyoteTimer, jumpBufferTimer, jumpCutUsed,
  jumping}`; `input` = `{moveX, moveZ, run, jumpPressed, jumpHeld}` with
  world-space move (magnitude <= 1). Accelerate the horizontal velocity vector
  toward `move * (run ? RUN_SPEED : WALK_SPEED)` at GROUND/AIR_ACCEL; without
  input decelerate at GROUND/AIR_DECEL. Coyote: on ground set
  `coyoteTimer = COYOTE_TIME`, else count down. Buffer: `jumpPressed` sets
  `jumpBufferTimer = JUMP_BUFFER_TIME`, else count down. Jump when both timers
  are positive: `vy = horizontalSpeed > RUN_JUMP_SPEED_THRESHOLD ?
  RUN_JUMP_VELOCITY : JUMP_VELOCITY`, clear both timers, `jumping = true`,
  `onGround = false`. While `jumping && !jumpHeld && vy > 0 && !jumpCutUsed`:
  `vy *= JUMP_CUT_MULTIPLIER` once. Returns `{jumped, jumpVelocity}`.
- `classifyEnemyContact(prevBottomY, body, enemyAABB)` returns `'stomp'` when
  overlapping, `body.vy < 0`, and `prevBottomY >= enemyAABB.maxY -
  STOMP_TOLERANCE`; `'hurt'` for any other overlap; otherwise `null`.
- `stepWalker(entity, dt, colliders)`: sets `vx = dir * speed`, `vz = 0`, calls
  `stepBody`, flips `dir` on `hitWallX`, returns the stepBody result.
- `stepFireball(fireball, dt, colliders)`: `stepBody`; on landing set `vy =
  FIREBALL_BOUNCE_VELOCITY`; any wall hit kills it; returns `{alive, bounced,
  hitWall}`.

`tests/physics.test.js` must cover: landing sets onGround/vy 0; wall stops X;
head bump picks the larger-overlap block of two; coyote jump works at 0.08 s
and fails at 0.15 s; buffered jump fires on landing; tap apex is at least 0.8 m
lower than held apex; run jump apex exceeds walk jump apex; stomp vs hurt vs
null; walker flips at a wall; fireball bounces then dies on a wall.

## 7. Visual modules

### 7.1 Textures: `src/textures.js`

`KUDLA.Textures`. Every function caches and returns the same instance for the
same arguments. Colour textures use sRGB encoding and anisotropy 4.

- `canvasTexture(width, height, draw, options)`: builds a canvas, calls
  `draw(ctx, width, height)`, returns `THREE.CanvasTexture`; options `{repeat,
  cacheKey}` (repeat sets RepeatWrapping on both axes).
- Block faces, 256x256: `tileBlock()` (Mangalore tiles: two rows of
  overlapping terracotta tiles, each with two raised lengthwise ribs and a
  curved shadowed lip, speckle noise, thin dark edge so it reads as a block,
  tiny oval maker's stamp); `mysteryBlock()` (Goli Baje block: bevelled gold
  face, four rivets, big dark-brown `?` with drop shadow, small `ದಾದ?` below
  it); `usedBlock()` (dark laterite, bevelled, pores, no symbol);
  `laterite()` (tileable red laterite: coursed stones, dark vesicular pores,
  light speckles).
- Environment, 512x512, tileable (caller sets `repeat`): `platformFloor()`
  (grey stone slabs, one texture = 2.4 m square); `tactileStrip()` (yellow
  with raised dots); `ballast()`; `wallPlaster()` (cream with subtle
  weathering); `canopyUnderside()` (Mangalore tile undersides between dark
  wooden battens); `roofTiles()` (top view of a Mangalore tile roof);
  `boundaryWall()` (laterite blocks, mortar, moss); `water()` (dark teal
  ripples).
- Signage: `stationNameBoard()` (1024x384, `irYellow` with black border, three
  centred lines `ಮಂಗಳೂರು ಸೆಂಟ್ರಲ್`, `मंगलूरु सेंट्रल`, `MANGALURU CENTRAL`);
  `textBoard(lines, options)` (options `{bg, fg, border, width, height}`,
  defaults yellow/black 1024x256); `ledBoard(text)` (1024x128 black with amber
  dot-matrix text); `poster(key)` (512x768: draws `KUDLA.POSTERS[key]` when
  present, loading asynchronously and setting `needsUpdate`, with a title band
  across the bottom 18%; otherwise procedural fallback art for that key).
  Poster keys and band titles: yakshagana `YAKSHAGANA · TONIGHT`; kambala
  `KAMBALA · BUFFALO RACE`; pilivesha `PILI VESHA · MANGALURU DASARA`; gadbad
  `GADBAD ICE CREAM`; panambur `PANAMBUR BEACH`.
- `icon(name)` returns a 96x96 `HTMLCanvasElement` (not a texture) for the HUD:
  `cashew`, `buns`, `gheeroast`, `gadbad`, `coconut`, `denji`, `crow`, `tile`,
  `mystery`, `laterite`.
- Font stacks: Kannada `"Noto Sans Kannada", "Kannada Sangam MN", "Tunga",
  "Nirmala UI", sans-serif`; Devanagari `"Noto Sans Devanagari", "Kohinoor
  Devanagari", "Mangal", "Nirmala UI", sans-serif`; Latin `"Baloo 2",
  "Trebuchet MS", "Segoe UI", sans-serif`. `main.js` awaits
  `document.fonts.ready` (1500 ms cap) before any texture is created.

### 7.2 Models: `src/models.js`

`KUDLA.Models`. Shared geometry and materials per kind. Every created object
sets `userData.kind`. Bounding sizes (from `THREE.Box3().setFromObject`) must
match within 15%.

- `createBlock(kind)`: `THREE.Mesh`, kinds `tile | mystery | used | laterite`,
  1x1x1 centred, castShadow and receiveShadow. The mystery material has a
  slight warm emissive. `setBlockKind(mesh, kind)` swaps the material and sets
  `userData.blockKind`.
- `createCashew()`: kidney-shaped golden cashew (partial torus, one end
  fuller), metallic gold with warm emissive, fits a 0.6 cube.
- `createItem(type)`: fits a 0.8 cube. `buns`: puffy golden-brown Mangalore
  buns on a banana leaf. `gheeroast`: brass bowl of glossy red ghee roast with
  two red chillies. `gadbad`: tall glass with pink, yellow, green, chocolate
  layers and a cherry. `coconut`: green tender coconut with cut top and a
  striped straw. `userData.itemType = type`.
- `createEnemy(type)`: `crab` (Denji: orange-red shell, eye stalks, angry
  brows, two raised claws, six legs; fits `CRAB_SIZE`); `crow` (Indian house
  crow: black body, grey nape, dark beak, flapping wings; fits `CROW_SIZE`);
  `chimney_crow` (perched crow, beak open; fits `CHIMNEY_CROW_SIZE`).
- `createFireball()`: glowing red chilli with green stem, fits a 0.5 cube.
- `createPlayer()`: third-person traveller (red cap, blue shirt, brown
  trousers, yellow backpack, skin `#C68642`) built with named parts for limb
  animation. `setPlayerPower(object, power)`: `small` total height 1.1,
  `big` 1.8, `fire` 1.8 with an orange-red shirt.
- `createShard()`: small terracotta tile shard mesh.
- `createScorePopup(text)`: `THREE.Sprite`, white bold text with a dark
  outline, `depthTest: false`, transparent, scale (1.4, 0.52, 1),
  `renderOrder` 999; the texture is cached per text.
- `animate(object, time, state, extra)`: dispatches on `userData.kind`. crab
  states `walk | squashed | dead` (legs scuttle and claws snap; squashed sets
  scale.y 0.3; dead flips upside down); crow and chimney_crow `fly | dead`;
  player `idle | run | jump` with `extra` = horizontal speed; item spins
  slowly (gadbad also pulses its emissive hue); cashew spins about Y; fireball
  tumbles. Animate is idempotent for a given (time, state).

### 7.3 Scenery: `src/scenery.js`

`KUDLA.Scenery.build(scene, level)` returns `{sun, standingTrain, flagPole,
update}`. Pure scene graph (no renderer or DOM access) so it runs in Node
smoke tests.

- Sky dome with vertex-colour gradient (`sky` to `horizon`), sun disc,
  drifting clouds; `scene.fog = new THREE.Fog(fog, 70, 320)`.
- Lights: `HemisphereLight('#CFE8FF', '#8A6A4A', 0.8)` and a warm
  `DirectionalLight('#FFE2B0', 1.05)` with shadows (map 2048, ortho box +/-30,
  bias -0.0006, normalBias 0.02) whose target is in the scene. `main.js` keeps
  `sun.position = player + (-30, 50, 25)` and `sun.target.position = player`.
- Renders every solid by kind (`barrier` stays invisible): platform slabs
  (stone top, tactile strip, coping, concrete side), pits (drain walls plus
  animated water at `PIT_WATER_Y`), laterite columns, kiln chimneys (brick,
  soot, smoke puffs), cast-iron pillars, steel benches, tea stalls with
  striped awnings and menu boards, low-poly NPCs (porter in red shirt with
  brass armband and a suitcase on his head; saree with jasmine in her hair;
  mundu reading a newspaper; guard in white waving a green flag).
- Station building along z = -4.0 (cream plaster, maroon dado, arched
  windows, green doors labelled WAITING ROOM, BOOKING OFFICE, STATION MASTER,
  CLOAK ROOM) topped by a sloping Mangalore-tile roof. Canopies over canopy
  sections: tile underside at y 8.0, trusses, scalloped fascia.
- Tracks 1 and 2 (ballast bed, instanced concrete sleepers every 0.6 m, two
  rails), overhead electric masts and wires, the laterite boundary wall, and a
  background of palms, Mangalore-tiled houses, a hill with a lighthouse
  (Light House Hill) beyond the tracks, and Western Ghats silhouettes behind
  the building.
- Decor types: `overheadBoard`, `ledBoard` (scrolling), `wallBoard`,
  `farBoard`, `poster`, `clock` (shows real local time), `sign` (styles
  `caution` white/red, `info` green/white, `run` yellow/black), `signal`,
  `dustbin`, `waterTap`.
- `standingTrain`: 12620 Matsyagandha Express on Track 1 (red and cream
  electric loco at the +X front, `level.train.cars` ICF-blue coaches with a
  cream window band, coach codes, yellow destination boards, open door at
  `doorX`); origin at the rear-end centre on the rail top, extending +X;
  positioned at `(rearX, RAIL_TOP_Y, z)`.
- `flagPole`: 11 m pole with a fluttering green flag; `userData.flag` is the
  flag object (the game lowers it) and `userData.height` the pole height.
- Goods trains on Track 2: diesel loco plus `GOODS_TRAIN.WAGONS` brown covered
  wagons at `GOODS_TRAIN.SPEED`, first pass at `FIRST_PASS` s then every
  `INTERVAL` s, alternating direction, entering and leaving beyond the fog.
- `update(dt, time, playerPos)` animates clouds, water, LED text, flags,
  smoke, clock hands, and goods trains, and returns `{horn, rumble}`: `horn`
  is true on the frame an approaching loco comes within 120 m of the player
  along X; `rumble` in [0, 1] grows as the train nears the player.

### 7.4 Fake DOM for Node smoke tests: `tests/helpers/fake_dom.js`

Exports `createContext()` and `loadScripts(context, relativePaths)`.
`createContext()` returns a `vm` context whose global object is also `window`
and `globalThis`, with `document` (`createElement('canvas')` returns a
FakeCanvas, `getElementById` returns null, `body` stub, no `fonts`), an `Image`
class that never fires `onload`, `performance`, `requestAnimationFrame`
(no-op), in-memory `localStorage`, `navigator`, `console`, `setTimeout`, and
`clearTimeout`. FakeCanvas has `width`, `height`, `style`, `toDataURL()`, and
`getContext('2d')` returning a Proxy where every method is a no-op except
`measureText` (`{width}`), gradient and pattern factories (`{addColorStop}`),
and `getImageData` (`{data: Uint8ClampedArray}`). `loadScripts` resolves paths
against the project root and runs each with `vm.runInContext` (filename set).

## 8. UI modules

### 8.1 `index.html` element ids

`game-root`, `game-canvas`; HUD `hud`, `hud-score`, `hud-cashews`,
`hud-world`, `hud-time`, `hud-lives`, `hud-power`, `hud-progress`,
`hud-progress-fill`, `hud-progress-marker`, `hud-toast`, `hud-crosshair`,
`hud-flash`, `hud-camera`, `hud-mute`; screens (class `screen`, the visible one
also has `is-active`) `screen-loading`, `screen-title`, `screen-pause`,
`screen-dead`, `screen-gameover`, `screen-clear`; controls `btn-start`,
`title-best`, `title-legend`, `btn-resume`, `btn-restart-pause`,
`opt-sensitivity` (range 0.2-3.0 step 0.1), `opt-invert`, `opt-mute`,
`opt-camera-third`, `dead-message`, `dead-lives`, `gameover-message`,
`gameover-score`, `btn-restart-over`, `clear-score`, `clear-time-bonus`,
`clear-flag-bonus`, `clear-best`, `btn-restart-clear`, `loading-bar`,
`loading-label`.

### 8.2 HUD: `src/hud.js`

`KUDLA.HUD`: `init()`; `on(eventName, callback)` for `start`, `resume`,
`restart`, `sensitivity` (value), `invert` (bool), `mute` (bool), `camera`
(`first | third`); `update(state)` with `{score, cashews, lives, time, power,
starTime, progress, cameraMode, muted}` (cheap: only touch the DOM when a
value changes); `toast(text, variant)` with variants `info | power | warn |
bonus` (about 2.2 s, queue of 3); `showScreen(name, data)` for `loading |
title | pause | dead | gameover | clear | none` (data: title `{best}`, pause
`{settings}`, dead `{message, lives}`, gameover `{message, score}`, clear
`{score, timeBonus, flagBonus, best, newBest}`); `setHurry(active)`;
`flash(kind)` for `hurt | power | star | none` (`star` persists until `none`);
`setCrosshairVisible(visible)`; `setLoadingProgress(fraction, label)`. The
title legend is filled from `KUDLA.Textures.icon(name)` when available.

### 8.3 Input: `src/input.js`

`KUDLA.Input`: `init(canvas)`; `poll()` returns `{moveForward, moveRight, run,
jumpPressed, jumpHeld, firePressed, cameraToggle, mutePressed, pausePressed,
confirmPressed, lookX, lookY}` and clears edge flags and look deltas.
`moveForward`/`moveRight` are in [-1, 1]; `lookX`/`lookY` are radians to add to
yaw/pitch (already scaled by `CAMERA.MOUSE_SENSITIVITY` times the user
multiplier; positive `lookY` looks up; invert applied). `*Pressed` fields are
true once per physical press. Space and arrows call `preventDefault`. Left
click fires only while locked, and the click that acquires the lock never
fires. Also `requestPointerLock()`, `exitPointerLock()`,
`isPointerLocked()`, `onPointerLockChange(callback)`,
`setSensitivity(multiplier)`, `setInvertY(bool)`, `getSettings()` (persisted
via `Config.STORAGE_KEYS`). Gamepad per §2 (deadzone 0.18, look 2.6 rad/s times
the multiplier).

### 8.4 Audio: `src/audio.js`

`KUDLA.Audio`: `init()` (idempotent; creates or resumes the AudioContext from
a user gesture); `play(name)` for `jump | bigjump | cashew | bump | break |
powerup_appear | powerup | oneup | stomp | kick | fireball | hurt | die | flag
| clear | horn | pause | hurry | chime | tick`; `startMusic(mode)` for `main |
hurry | star` (looping, crossfaded); `stopMusic()`; `setMuted(bool)`,
`isMuted()`, `toggleMute()` (persisted); `announce(text)` (chime then
`speechSynthesis`, preferring an en-IN voice; no-op when muted or
unsupported); `setRumble(intensity)` (continuous low rumble, 0-1). Everything
is synthesised (oscillators, noise buffers, envelopes). Music is an original
upbeat 140 BPM loop in Mohanam (C D E G A pentatonic) with a square lead,
triangle bass, and noise tabla taps; never reproduce any Nintendo melody or
the Indian Railways jingle. `hurry` is the same loop 1.25 times faster;
`star` is a bright 160 BPM arpeggio loop. `horn` is a two-tone loco horn
(about 311 Hz and 392 Hz, low-passed, 1.3 s); `chime` is an original
three-note bell (E5, C5, G4).

## 9. Game rules: `src/game.js` and `src/main.js`

- `KUDLA.Game` must be constructible in Node without a renderer or DOM:
  `new KUDLA.Game({scene, level, scenery, audio, hud})`, where missing
  `audio`/`hud` default to no-op stubs. Methods: `start()`, `step(dt, input)`
  (input as returned by `Input.poll()`), `getCameraState()` returning `{eye,
  yaw, pitch, mode, fov, roll}`, `getState()` returning `{state, score,
  cashews, lives, time, power, starTime, progress, playerPos}`.
- States: `loading`, `title`, `playing`, `paused`, `dying`, `flag`, `clear`,
  `gameover`. Losing pointer lock while playing pauses; Resume re-locks.
- Fixed step `FIXED_DT` with the frame delta clamped to `MAX_FRAME_DT`; edge
  inputs apply on the first substep only.
- Blocks (hit from below via `stepBody().hitHead`): tile/none breaks when big
  or fire (4 shards, +50, `break`), otherwise bumps (`bump`); mystery/cashew
  pops a cashew (+200, cashew +1); mystery/powerup emerges Buns when small,
  Ghee Roast otherwise (`powerup_appear`); tile/star emerges Gadbad that
  bounces along +X; tile/multi gives a cashew per hit within
  `MULTI_CASHEW_WINDOW` up to `MULTI_CASHEW_MAX`; hidden blocks are invisible
  and non-solid until hit from below by a rising player, then become used and
  emerge a tender coconut. Dispensing turns the block `used`; used and
  laterite only `tick`. Every bump animates the block up `BUMP_HEIGHT` and
  back over `BUMP_TIME`, kills enemies standing on it (+100), and pops items on
  it upward.
- Items: Buns and coconut walk along +X at `ITEM_SPEED` (reverse at walls);
  Ghee Roast stays put. Buns make the player big (+1000 if already big); Ghee
  Roast makes fire; Gadbad gives `STAR_TIME` s invincibility with `star`
  music; coconut gives +1 life.
- Damage: star kills the enemy (+200, `kick`); invulnerable ignores; big or
  fire shrinks to small with `INVULN_TIME` s invulnerability (`hurt`, red
  flash); small dies. Stomps squash crabs (`CRAB_SQUASH_TIME`) or drop crows,
  bounce the player (`STOMP_BOUNCE_HELD_VELOCITY` when jump is held, else
  `STOMP_BOUNCE_VELOCITY`), and score along `STOMP_CHAIN` until landing (past
  the end: 1-up). Chimney crows cannot be stomped.
- Fireballs (fire power only): spawn 0.5 m ahead of the eye, 0.4 m below it,
  horizontal velocity forward times `FIREBALL_SPEED`, at most `MAX_FIREBALLS`,
  `FIREBALL_LIFETIME` s; kill enemies (+200).
- Crabs activate within `ACTIVATION_DISTANCE` m along X, walk with
  `Physics.stepWalker`, reverse on walls, blocks, and each other, fall into
  pits. Crows hover with a sine bob, chase within `CROW_AGGRO_RANGE`, ignore
  geometry. Chimney crows cycle per `CHIMNEY_CROW_CYCLE` and stay hidden while
  the player is within `CHIMNEY_CROW_SAFE_RADIUS` of the chimney axis.
  Enemies yaw to face the player.
- Cashews: +1 and +200 each; every `CASHEWS_PER_LIFE` gives a life and wraps.
- Falling below `KILL_Y` dies. The timer counts down `LEVEL_TIME`; at
  `HURRY_TIME` play `hurry`, switch to `hurry` music, `setHurry(true)`, toast,
  and announce; at 0 die with the time-up message.
- Death: `die`, stop music, `DEATH_ANIM_TIME` s camera roll and sink, lose a
  life; with lives left show the dead screen for `DEAD_SCREEN_TIME` s and
  respawn at the checkpoint (if crossed) or start with a fresh
  `Level.create()` (score and cashews kept, power small, timer reset); with
  none left show game over.
- Flag: crossing `x >= flag.x` at any z ends control. Score by feet height via
  `FLAG_SCORES` (`flag`), slide down the pole at 8 m/s while lowering
  `flagPole.userData.flag`, auto-walk to `(doorX, 0, 3.3)`, play `horn`, then
  the standing train accelerates along +X at `TRAIN.DEPART_ACCEL` for 5 s
  under a cinematic camera at `(doorX - 14, 3.2, -2.5)`. Count remaining
  seconds into `TIME_BONUS_PER_SECOND` points (`tick`), then show the clear
  screen and save the best score.
- Camera: first person at feet + height - `EYE_BELOW_TOP`, with head bob
  (`BOB_STRIDE`, `BOB_AMPLITUDE` scaled by speed, ground only), landing dip
  (`LANDING_DIP` when landing faster than 10 m/s), rumble shake (0.04 m times
  scenery rumble), and FOV easing to `RUN_FOV` above walk speed plus 1. Third
  person orbits behind at `THIRD_DISTANCE` and `THIRD_HEIGHT`, pitch
  controlled, looking at the chest; the avatar is visible only in third person.
- Announcements: on the first start announce `Attention please. Train number
  one two six two zero, Matsyagandha Express to Lokmanya Tilak Terminus, will
  depart from platform number one in four minutes.`; on scenery `horn` play
  `horn`; feed `rumble` to `Audio.setRumble`.
- Score popups rise 1.2 m over 0.8 s at the event position.
- Debug hooks: `?x=<number>` spawns at that x on the surface below;
  `?autoplay=1` holds forward and run and jumps every 0.9 s;
  `window.KUDLA.debug = {game}`.

## 10. Copy deck (use verbatim)

- Title: `SUPER KUDLA EXPRESS`; badge `ಕುಡ್ಲ`; tagline `Catch the Matsyagandha
  Express from Mangaluru Central!`
- Story: `Platform 1, Mangaluru Central. The 12620 Matsyagandha Express to
  Mumbai leaves in four minutes, and you are at the wrong end of the platform.
  Bump Goli Baje blocks for golden cashews and Kudla snacks, stomp the crabs,
  dodge the crows, and pass the guard's green flag before the train pulls
  out.`
- Legend: Golden Cashew `Kudla's famous cashews. 100 = extra life.`; Mangalore
  Buns `Sweet banana buns. You grow taller.`; Ghee Roast `Fiery! Throw chillies
  with F or click.`; Gadbad Ice Cream `Layers of joy. 10 seconds of
  invincibility.`; Tender Coconut (Bonda) `Extra life.`; Mangalore Tile Block
  `Bump when small, smash when big.`; Goli Baje Block `ದಾದ? What's inside?`;
  Denji (Crab) `Scuttles sideways. Stomp it.`; Station Crow `Swoops for your
  snacks.`
- Toasts: buns `MANGALORE BUNS! You grew taller.`; gheeroast `GHEE ROAST! Press
  F or click to throw chillies.`; gadbad `GADBAD! Invincible for 10 seconds.`;
  coconut `BONDA! 1-UP`; 100 cashews `100 CASHEWS! 1-UP`; hurry `ATTENTION
  PLEASE: Matsyagandha Express departs in 60 seconds!`; checkpoint `CHECKPOINT
  — halfway down Platform 1`; hurt `AYYO!`.
- Hurry announcement: `Attention please. Train number one two six two zero,
  Matsyagandha Express, departs in one minute.`
- Dead screen: `AYYO!` plus `Lives left: N`; time up `TIME UP! The train left
  without you.`
- Game over: `MISSED THE TRAIN! Better catch a private bus from Hampankatta.`
- Clear: `BOARDED! You caught the Matsyagandha Express.`

## 11. File ownership

| Files | Owner |
| --- | --- |
| `DESIGN.md`, `src/config.js`, `vendor/three.min.js` | conductor |
| `src/level.js`, `src/physics.js`, `tests/level.test.js`, `tests/physics.test.js`, `package.json` | logic worker |
| `src/textures.js`, `src/models.js`, `tests/helpers/fake_dom.js`, `tests/assets.smoke.test.js`, `tools/gallery.html` | art worker |
| `index.html`, `styles.css`, `src/hud.js`, `src/input.js`, `src/audio.js` | UI worker |
| `assets/posters.js`, `assets/posters/*.jpg`, `assets/keyart.jpg`, `tools/embed_posters.py` | poster worker |
| `src/scenery.js`, `tests/scenery.smoke.test.js` | scenery worker |
| `src/game.js`, `src/main.js`, `tests/game.smoke.test.js`, `README.md` | integrator |
