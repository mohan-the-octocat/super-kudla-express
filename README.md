# Super Kudla Express (ಕುಡ್ಲ)

**Super Kudla Express** is a first-person (and toggleable third-person) 3D Mario-style platformer built with Three.js r149, set on **Platform 1 of Mangaluru Central (MAQ)** railway station.

You have **240 seconds** and **3 lives** to sprint the length of Platform 1, bump Goli Baje mystery blocks, collect golden cashews and Mangalore snacks, stomp Denji crabs, dodge swooping station crows, and pass the guard's green flag before the **12620 Matsyagandha Express** (Mangaluru Central to Lokmanya Tilak Terminus, Mumbai) departs.

---

## How to Run

No build step, bundler, or network connection is required at runtime:

1. **Direct (`file://`)**: Double-click `index.html` in your file manager to open it directly in any modern desktop browser.
2. **Local HTTP server (`http://`)**:
   ```bash
   python3 -m http.server 8137
   ```
   Then open <http://localhost:8137> in your browser.

### QA hooks

The game supports URL query parameters for automated verification and test scenario driving. All hooks are parsed once at boot and ignored when invalid:

- `?autostart=1` — Skip the title screen and pointer lock, starting active gameplay immediately with idle input.
- `?autoplay=1` — Auto-start immediately without pointer lock or title screen, running a scripted demo input (hold forward + run, jump every 0.9 s).
- `?lowfx=1` — Low-quality fast rendering for software-GL test browsers (disables antialiasing, uses `BasicShadowMap`, throttles shadow map updates to player movement, caps pixel ratio to 1). Note that `tools/qa_drive.js` adds it automatically unless explicitly overridden (e.g. `?lowfx=0`).
- `?x=<number>` — Spawn at a specific X coordinate along Platform 1 (on the walkable surface below).
- `?cam=third` (or `?cam=first`) — Initial camera mode (`third` for third-person orbit camera, `first` for default first-person).
- `?yaw=<degrees>` — Initial horizontal look direction in degrees per DESIGN.md §4 conventions (`0` looks along +X toward the train; positive turns right toward the tracks).
- `?pitch=<degrees>` — Initial vertical look direction in degrees per DESIGN.md §4 conventions (positive looks up, clamped to `CAMERA.PITCH_LIMIT`).
- `?lives=<1-9>` — Starting lives count (integer between 1 and 9).

---

## Controls

| Action | Keyboard / Mouse | Gamepad (Standard Mapping) |
| --- | --- | --- |
| **Move** | `WASD` or Arrow keys | Left stick |
| **Look** | Mouse (pointer lock; click the game to lock) | Right stick |
| **Jump** (hold = higher) | `Space` | `A` (`0`) |
| **Run** | `Shift` (hold) | `X` (`2`) held |
| **Throw Chilli** (Ghee Roast only) | `F` or Left Click | `B` (`1`) |
| **Camera First / Third Person** | `V` | `Y` (`3`) |
| **Mute Audio** | `M` | — |
| **Pause** | `Esc` or `P` | `Start` (`9`) |
| **Confirm on Screens** | `Enter` | `A` (`0`) |

---

## Mangalore Theme Map

| Classic Platformer Element | Super Kudla Express Theme | Behaviour |
| --- | --- | --- |
| **Brick Block** | **Mangalore Tile Block** | Terracotta ribbed roof tiles. Bump when small; smash into 4 shards (+50 pts) when big or fiery. |
| **`?` Mystery Block** | **Goli Baje Block (`ದಾದ?`)** | Gold bevelled block asking *"ದಾದ?"* ("what?" in Tulu). Dispenses golden cashews or Kudla snacks, then turns into dark laterite. |
| **Hard / Stair Block** | **Laterite Stone (`Kempu Kallu`)** | Red vesicular laterite stone steps and pyramids along the platform. |
| **Warp Pipe** | **Tile-Kiln Chimney** | Soot-crowned brick chimneys; some shelter perched chimney crows. |
| **Coin** | **Golden Cashew** | +200 pts each. Collect 100 golden cashews for an extra life (1-UP). |
| **Super Mushroom** | **Mangalore Buns** | Sweet puffy banana buns served on a banana leaf. Grows you taller (`big` power). |
| **Fire Flower** | **Ghee Roast** | Spicy red Mangalorean ghee roast in a brass bowl. Lets you throw bouncing red chillies (`fire` power). |
| **Super Star** | **Gadbad Ice Cream** | Tall layered sundae glass with cherry on top. Grants 10 seconds of rainbow invincibility. |
| **1-Up Mushroom** | **Tender Coconut (`Bonda`)** | Hidden in secret blocks. Grants +1 extra life. |
| **Goomba** | **Denji (`ದೆಂಜಿ`, Crab)** | Orange-red coastal crab scuttling along the platform. Stomp to squash (+100 pts and chain combos). |
| **Paratroopa** | **Station Crow** | Indian house crow hovering and swooping toward your snacks. |
| **Piranha Plant** | **Chimney Crow** | Rises and sinks inside kiln chimneys; cannot be stomped, stays hidden when you stand beside the chimney. |
| **Flagpole & Castle** | **Guard's Green Flag & 12620 Matsyagandha Express** | Slide down the 11 m pole for up to 5000 pts and board the waiting ICF blue coaches before departure. |

---

## Project Layout

```text
super-kudla-express/
├── DESIGN.md                  # Full architectural specification and module contracts
├── index.html                 # Main game entry page (loads scripts in strict order)
├── styles.css                 # Indian Railways signage UI, LED pause board, HUD styling
├── vendor/
│   └── three.min.js           # Three.js r149 UMD build
├── assets/
│   └── posters.js             # Embedded data-URI station posters & key art
├── src/
│   ├── config.js              # Frozen tuning constants, geometry cross-section, palette
│   ├── level.js               # Platform 1 layout blueprint, static colliders, floor queries
│   ├── physics.js             # Swept 3D AABB collision, player kinematics, walkers, fireballs
│   ├── textures.js            # Procedural Canvas2D sRGB textures & 96x96 HUD icons
│   ├── models.js              # Procedural 3D meshes and idempotent animations
│   ├── scenery.js             # Station building, canopies, tracks, trains, hills, sky/sun
│   ├── audio.js               # Web Audio Mohanam raga synthesizer, SFX, PA announcements
│   ├── input.js               # Keyboard, pointer-lock mouse, and gamepad polling
│   ├── hud.js                 # HUD updates, toasts, and screen overlays
│   ├── game.js                # Complete game rules engine and camera controller
│   └── main.js                # Browser bootstrap, renderer setup, and main loop
├── tests/
│   ├── helpers/fake_dom.js    # Minimal VM DOM/Canvas2D context for Node smoke tests
│   ├── physics.test.js        # Unit tests for 3D AABB physics and player motion
│   ├── level.test.js          # Blueprint validation and simulated pit-jump proofs
│   ├── assets.smoke.test.js   # Texture caching, model Box3 bounds, animation tests
│   ├── scenery.smoke.test.js  # Scenery graph and goods train horn/rumble tests
│   └── game.smoke.test.js     # End-to-end game rules and 30s autoplay smoke tests
└── tools/
    ├── gallery.html           # Visual asset & texture inspection gallery
    ├── embed_posters.py       # Utility to pack poster images into assets/posters.js
    └── qa_drive.js            # Real-time Chrome DevTools Protocol QA driver & screenshot tool
```

---

## Running Tests

All unit and smoke tests use Node.js built-in test runner (`node:test`, `node:assert/strict`, `node:vm`) with zero external dependencies:

```bash
node --test
```

### Real-time QA

`tools/qa_drive.js` is a zero-dependency Node 22 Chrome DevTools Protocol (CDP) harness that spawns `chrome-headless-shell` with SwiftShader WebGL (`--remote-debugging-port=0`), connects over WebSocket (`Page` and `Runtime` domains), drives the live `requestAnimationFrame` loop in real wall-clock time while polling `KUDLA.debug.game.getState()` and the active `.screen.is-active` overlay once per second, saves a final PNG screenshot to `/tmp/qa_<name>.png`, and exits non-zero if any runtime exception is thrown:

```bash
node tools/qa_drive.js <name> "<query>" <seconds>
# Example: drive 12 seconds of autoplay and save /tmp/qa_A.png
node tools/qa_drive.js A "?autoplay=1" 12
```

---

## Credits

- **3D Engine**: [Three.js r149](https://threejs.org/) (MIT License).
- **Art & Visuals**: Procedural 3D models and Canvas 2D textures; station cultural posters and title art AI-generated.
- **Audio & Music**: 100% synthesized in the browser via the Web Audio API (original 140 BPM composition in Carnatic *Mohanam* pentatonic raga) and Web Speech API station announcements.

