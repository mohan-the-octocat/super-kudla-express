/**
 * @fileoverview Level layout data for Super Kudla Express: Platform 1 of Mangaluru Central.
 * Encodes exact blueprint from DESIGN.md §5 and §5.1.
 */
(function (root) {
  'use strict';
  const KUDLA = (root.KUDLA = root.KUDLA || {});

  /**
   * Helper to create a row of blocks from a pattern string.
   * Codes: T = tile/none, C = mystery/cashew, P = mystery/powerup,
   * S = tile/star, M = tile/multi, U = hidden/oneup.
   */
  function createBlockRow(startX, pattern, blockY, blockZ, idPrefix) {
    const blocks = [];
    for (let index = 0; index < pattern.length; index++) {
      const charCode = pattern[index];
      let kind = 'tile';
      let contents = 'none';
      if (charCode === 'T') {
        kind = 'tile';
        contents = 'none';
      } else if (charCode === 'C') {
        kind = 'mystery';
        contents = 'cashew';
      } else if (charCode === 'P') {
        kind = 'mystery';
        contents = 'powerup';
      } else if (charCode === 'S') {
        kind = 'tile';
        contents = 'star';
      } else if (charCode === 'M') {
        kind = 'tile';
        contents = 'multi';
      } else if (charCode === 'U') {
        kind = 'hidden';
        contents = 'oneup';
      }
      blocks.push({
        id: `${idPrefix}-${index}`,
        kind: kind,
        contents: contents,
        x: startX + index,
        y: blockY,
        z: blockZ,
      });
    }
    return blocks;
  }

  /**
   * Helper to create stepped laterite columns.
   */
  function createLateriteStairs(specs, idPrefix) {
    const stairs = [];
    for (let index = 0; index < specs.length; index++) {
      const colSpec = specs[index];
      const colX = colSpec[0];
      const colH = colSpec[1];
      stairs.push({
        id: `${idPrefix}-${colX}`,
        kind: 'laterite',
        x: colX,
        y: 0,
        z: -0.2,
        w: 1.0,
        h: colH,
        d: 7.6,
        props: {},
      });
    }
    return stairs;
  }

  /**
   * Helper to create an arc of cashews.
   */
  function createCashewArc(xPoints, yPoints, zCoord, idPrefix) {
    const cashews = [];
    for (let index = 0; index < xPoints.length; index++) {
      cashews.push({
        id: `${idPrefix}-${index}`,
        x: xPoints[index],
        y: yPoints[index],
        z: zCoord !== undefined ? zCoord : 0,
      });
    }
    return cashews;
  }

  /**
   * Helper to create pillars along the platform.
   */
  function createPillars(xList, zCoord, idPrefix) {
    const pillars = [];
    for (let index = 0; index < xList.length; index++) {
      const pillarX = xList[index];
      pillars.push({
        id: `${idPrefix}-${pillarX}`,
        kind: 'pillar',
        x: pillarX,
        y: 0,
        z: zCoord,
        w: 0.5,
        h: 8.0,
        d: 0.5,
        props: {},
      });
    }
    return pillars;
  }

  /**
   * Helper to create benches.
   */
  function createBenches(xList, zCoord, idPrefix) {
    const benches = [];
    for (let index = 0; index < xList.length; index++) {
      const benchX = xList[index];
      benches.push({
        id: `${idPrefix}-${benchX}`,
        kind: 'bench',
        x: benchX,
        y: 0,
        z: zCoord,
        w: 2.2,
        h: 0.5,
        d: 0.7,
        props: {},
      });
    }
    return benches;
  }

  /**
   * Creates a fresh deep object containing the full level layout.
   * @return {!Object} Complete level description.
   */
  function create() {
    const Config = KUDLA.Config;

    const sections = [
      { id: 'section-booking', x0: -6, x1: 32, canopy: true, label: 'Booking Hall' },
      { id: 'section-kiln', x0: 32, x1: 78, canopy: false, label: 'Tile Kiln Yard' },
      { id: 'section-drain', x0: 78, x1: 112, canopy: true, label: 'Monsoon Drain' },
      { id: 'section-tea', x0: 112, x1: 150, canopy: true, label: 'Tea & Tiles' },
      { id: 'section-steps', x0: 150, x1: 200, canopy: false, label: 'Laterite Steps' },
      { id: 'section-flag', x0: 200, x1: 240, canopy: false, label: "Guard's Flag" },
    ];

    const pits = [
      { id: 'pit-a', x0: 70, x1: 74 },
      { id: 'pit-b', x0: 138, x1: 142.5 },
      { id: 'pit-c', x0: 169.5, x1: 173.5 },
      { id: 'pit-d', x0: 186, x1: 191.5 },
    ];

    const solids = [];

    // Floor platforms (5 spans)
    const floorSpans = [
      [-6, 70],
      [74, 138],
      [142.5, 169.5],
      [173.5, 186],
      [191.5, 240],
    ];
    for (let index = 0; index < floorSpans.length; index++) {
      const span = floorSpans[index];
      solids.push({
        id: `floor-${index}`,
        kind: 'platform',
        x: (span[0] + span[1]) / 2,
        y: Config.GEOMETRY.PLATFORM_BOTTOM,
        z: 0,
        w: span[1] - span[0],
        h: Config.GEOMETRY.PLATFORM_TOP - Config.GEOMETRY.PLATFORM_BOTTOM,
        d: 8.0,
        props: {},
      });
    }

    // Barriers
    solids.push({
      id: 'barrier-back',
      kind: 'barrier',
      x: 117,
      y: -10,
      z: -4.25,
      w: 247,
      h: 40,
      d: 0.5,
      props: {},
    });
    solids.push({
      id: 'barrier-edge',
      kind: 'barrier',
      x: 117,
      y: -10,
      z: 3.85,
      w: 247,
      h: 40,
      d: 0.5,
      props: {},
    });
    solids.push({
      id: 'barrier-start',
      kind: 'barrier',
      x: -6.25,
      y: -10,
      z: -0.2,
      w: 0.5,
      h: 40,
      d: 8.6,
      props: {},
    });
    solids.push({
      id: 'barrier-end',
      kind: 'barrier',
      x: 240.25,
      y: -10,
      z: -0.2,
      w: 0.5,
      h: 40,
      d: 8.6,
      props: {},
    });

    // Canopy lids
    solids.push({
      id: 'barrier-canopy-booking',
      kind: 'barrier',
      x: 13,
      y: Config.GEOMETRY.CANOPY_Y,
      z: 0,
      w: 38,
      h: 0.5,
      d: 8.0,
      props: {},
    });
    solids.push({
      id: 'barrier-canopy-drain',
      kind: 'barrier',
      x: 95,
      y: Config.GEOMETRY.CANOPY_Y,
      z: 0,
      w: 34,
      h: 0.5,
      d: 8.0,
      props: {},
    });
    solids.push({
      id: 'barrier-canopy-tea',
      kind: 'barrier',
      x: 131,
      y: Config.GEOMETRY.CANOPY_Y,
      z: 0,
      w: 38,
      h: 0.5,
      d: 8.0,
      props: {},
    });

    // Pillars
    const pillarXList = [0, 10, 20, 30, 80, 90, 100, 110, 120, 130];
    const pillars = createPillars(pillarXList, -2.2, 'pillar');
    for (let index = 0; index < pillars.length; index++) {
      solids.push(pillars[index]);
    }

    // Benches
    const benchXList = [8, 30, 92, 104, 134, 230];
    const benches = createBenches(benchXList, -3.3, 'bench');
    for (let index = 0; index < benches.length; index++) {
      solids.push(benches[index]);
    }

    // Stalls
    solids.push({
      id: 'stall-24',
      kind: 'stall',
      x: 24,
      y: 0,
      z: -3.3,
      w: 3.0,
      h: 2.6,
      d: 1.4,
      props: {
        name: 'KUDLA TEA STALL',
        menu: ['Goli Baje', 'Buns', 'Neer Dosa', 'Kaapi / Chai'],
      },
    });
    solids.push({
      id: 'stall-116',
      kind: 'stall',
      x: 116,
      y: 0,
      z: -3.3,
      w: 3.0,
      h: 2.6,
      d: 1.4,
      props: {
        name: 'GADBAD CORNER',
        menu: ['Gadbad', 'Parfait', 'Kulfi', 'Fresh Juice'],
      },
    });

    // NPCs
    solids.push({
      id: 'npc-porter-4',
      kind: 'npc',
      x: 4,
      y: 0,
      z: -3.3,
      w: 0.6,
      h: 1.7,
      d: 0.6,
      props: { variant: 'porter' },
    });
    solids.push({
      id: 'npc-saree-13',
      kind: 'npc',
      x: 13,
      y: 0,
      z: -3.3,
      w: 0.6,
      h: 1.7,
      d: 0.6,
      props: { variant: 'saree' },
    });
    solids.push({
      id: 'npc-mundu-28',
      kind: 'npc',
      x: 28,
      y: 0,
      z: -3.3,
      w: 0.6,
      h: 1.7,
      d: 0.6,
      props: { variant: 'mundu' },
    });
    solids.push({
      id: 'npc-mundu-98',
      kind: 'npc',
      x: 98,
      y: 0,
      z: -3.3,
      w: 0.6,
      h: 1.7,
      d: 0.6,
      props: { variant: 'mundu' },
    });
    solids.push({
      id: 'npc-saree-122',
      kind: 'npc',
      x: 122,
      y: 0,
      z: -3.3,
      w: 0.6,
      h: 1.7,
      d: 0.6,
      props: { variant: 'saree' },
    });
    solids.push({
      id: 'npc-guard-219.5',
      kind: 'npc',
      x: 219.5,
      y: 0,
      z: 2.2,
      w: 0.6,
      h: 1.7,
      d: 0.6,
      props: { variant: 'guard' },
    });

    // Chimneys
    solids.push({ id: 'chimney-36', kind: 'chimney', x: 36, y: 0, z: 0, w: 1.8, h: 2.0, d: 1.8, props: {} });
    solids.push({ id: 'chimney-45', kind: 'chimney', x: 45, y: 0, z: 0, w: 1.8, h: 3.0, d: 1.8, props: {} });
    solids.push({ id: 'chimney-54', kind: 'chimney', x: 54, y: 0, z: 0, w: 1.8, h: 4.0, d: 1.8, props: {} });
    solids.push({ id: 'chimney-63', kind: 'chimney', x: 63, y: 0, z: 0, w: 1.8, h: 3.0, d: 1.8, props: {} });

    // Laterite columns
    const pyr1Specs = [
      [152, 1], [153, 2], [154, 3], [155, 4],
      [156, 4], [157, 3], [158, 2], [159, 1],
    ];
    const pyr1Columns = createLateriteStairs(pyr1Specs, 'laterite-pyr1');
    for (let index = 0; index < pyr1Columns.length; index++) {
      solids.push(pyr1Columns[index]);
    }

    const pyr2Specs = [
      [165, 1], [166, 2], [167, 3], [168, 4], [169, 4],
      [174, 4], [175, 3], [176, 2], [177, 1],
    ];
    const pyr2Columns = createLateriteStairs(pyr2Specs, 'laterite-pyr2');
    for (let index = 0; index < pyr2Columns.length; index++) {
      solids.push(pyr2Columns[index]);
    }

    const finalStairSpecs = [
      [203, 1], [204, 2], [205, 3], [206, 4],
      [207, 5], [208, 6], [209, 7], [210, 8],
      [211, 8],
    ];
    const finalStairColumns = createLateriteStairs(finalStairSpecs, 'laterite-stair');
    for (let index = 0; index < finalStairColumns.length; index++) {
      solids.push(finalStairColumns[index]);
    }

    // Blocks
    const blocks = [];
    blocks.push({ id: 'block-12', kind: 'mystery', contents: 'cashew', x: 12, y: 3.0, z: 0 });
    const row17 = createBlockRow(17, 'TPTCT', 3.0, 0, 'block-17');
    for (let index = 0; index < row17.length; index++) {
      blocks.push(row17[index]);
    }
    blocks.push({ id: 'block-66.5', kind: 'hidden', contents: 'oneup', x: 66.5, y: 3.0, z: 0 });
    const row79 = createBlockRow(79, 'TCT', 3.0, 0, 'block-79');
    for (let index = 0; index < row79.length; index++) {
      blocks.push(row79[index]);
    }
    for (let gridX = 86; gridX <= 88; gridX++) {
      for (let gridZ = -1; gridZ <= 1; gridZ++) {
        const isPowerup = (gridX === 87 && gridZ === 0);
        blocks.push({
          id: `block-grid-${gridX}-z${gridZ}`,
          kind: isPowerup ? 'mystery' : 'tile',
          contents: isPowerup ? 'powerup' : 'none',
          x: gridX,
          y: 3.0,
          z: gridZ,
        });
      }
    }
    blocks.push({ id: 'block-106', kind: 'tile', contents: 'multi', x: 106, y: 3.0, z: 0 });
    const row117 = createBlockRow(117, 'TSTT', 3.0, 0.5, 'block-117');
    for (let index = 0; index < row117.length; index++) {
      blocks.push(row117[index]);
    }
    const row126 = createBlockRow(126, 'CTC', 3.0, -2.0, 'block-126');
    for (let index = 0; index < row126.length; index++) {
      blocks.push(row126[index]);
    }
    blocks.push({ id: 'block-147', kind: 'hidden', contents: 'oneup', x: 147, y: 3.0, z: 0 });
    const row161 = createBlockRow(161, 'TPT', 3.0, 0, 'block-161');
    for (let index = 0; index < row161.length; index++) {
      blocks.push(row161[index]);
    }
    const row195 = createBlockRow(195, 'CTC', 3.0, 1.0, 'block-195');
    for (let index = 0; index < row195.length; index++) {
      blocks.push(row195[index]);
    }

    // Free cashews
    const cashews = [];
    cashews.push({ id: 'cashew-6-zm1', x: 6, y: 0.3, z: -1 });
    cashews.push({ id: 'cashew-6-z0', x: 6, y: 0.3, z: 0 });
    cashews.push({ id: 'cashew-6-zp1', x: 6, y: 0.3, z: 1 });
    for (let stepVal = 38.5; stepVal <= 42.5; stepVal += 1.0) {
      cashews.push({ id: `cashew-line-${stepVal}`, x: stepVal, y: 1.0, z: 0 });
    }
    cashews.push({ id: 'cashew-chimney-36', x: 36, y: 2.4, z: 0 });
    cashews.push({ id: 'cashew-chimney-45', x: 45, y: 3.4, z: 0 });
    cashews.push({ id: 'cashew-chimney-63', x: 63, y: 3.4, z: 0 });

    const pitACashews = createCashewArc([70.5, 71.25, 72, 72.75, 73.5], [1.2, 2.0, 2.4, 2.0, 1.2], 0, 'cashew-pit-a');
    for (let index = 0; index < pitACashews.length; index++) {
      cashews.push(pitACashews[index]);
    }

    const diagX = [110, 111, 112, 113, 114, 115];
    const diagZ = [-3, -2, -1, 0, 1, 2];
    for (let index = 0; index < diagX.length; index++) {
      cashews.push({ id: `cashew-diag-${diagX[index]}`, x: diagX[index], y: 0.3, z: diagZ[index] });
    }

    const pitBCashews = createCashewArc([138.5, 139.375, 140.25, 141.125, 142.0], [1.2, 2.0, 2.4, 2.0, 1.2], 0, 'cashew-pit-b');
    for (let index = 0; index < pitBCashews.length; index++) {
      cashews.push(pitBCashews[index]);
    }

    const pitCCashews = createCashewArc([170, 170.75, 171.5, 172.25, 173.0], [5.2, 6.0, 6.4, 6.0, 5.2], 0, 'cashew-pit-c');
    for (let index = 0; index < pitCCashews.length; index++) {
      cashews.push(pitCCashews[index]);
    }

    const pitDCashews = createCashewArc([186.5, 187.4, 188.3, 189.2, 190.1, 191.0], [1.2, 2.2, 2.8, 2.8, 2.2, 1.2], 0, 'cashew-pit-d');
    for (let index = 0; index < pitDCashews.length; index++) {
      cashews.push(pitDCashews[index]);
    }

    const stairCashews = createCashewArc([203, 204, 205, 206, 207, 208, 209, 210], [1.4, 2.4, 3.4, 4.4, 5.4, 6.4, 7.4, 8.4], 0, 'cashew-stair');
    for (let index = 0; index < stairCashews.length; index++) {
      cashews.push(stairCashews[index]);
    }

    // Enemies
    const enemies = [
      { id: 'crab-27', type: 'crab', x: 27, y: 0, z: 0, dir: -1 },
      { id: 'crab-41', type: 'crab', x: 41, y: 0, z: 1.0, dir: -1 },
      { id: 'crab-49.5', type: 'crab', x: 49.5, y: 0, z: -1.0, dir: -1 },
      { id: 'crab-50.7', type: 'crab', x: 50.7, y: 0, z: -1.0, dir: -1 },
      { id: 'crab-59', type: 'crab', x: 59, y: 0, z: 1.5, dir: -1 },
      { id: 'chimney-crow-54', type: 'chimney_crow', x: 54, y: 4.0, z: 0, dir: -1, chimneyId: 'chimney-54' },
      { id: 'chimney-crow-63', type: 'chimney_crow', x: 63, y: 3.0, z: 0, dir: -1, chimneyId: 'chimney-63' },
      { id: 'crow-95', type: 'crow', x: 95, y: 2.8, z: 0, dir: -1 },
      { id: 'crab-100', type: 'crab', x: 100, y: 0, z: 0, dir: -1 },
      { id: 'crab-102', type: 'crab', x: 102, y: 0, z: -1.2, dir: -1 },
      { id: 'crab-124', type: 'crab', x: 124, y: 0, z: 0.5, dir: -1 },
      { id: 'crab-130.5', type: 'crab', x: 130.5, y: 0, z: -1, dir: -1 },
      { id: 'crab-131.7', type: 'crab', x: 131.7, y: 0, z: -1, dir: -1 },
      { id: 'crow-146', type: 'crow', x: 146, y: 2.8, z: 1.0, dir: -1 },
      { id: 'crab-162', type: 'crab', x: 162, y: 0, z: 0, dir: -1 },
      { id: 'crab-163.2', type: 'crab', x: 163.2, y: 0, z: 1.0, dir: -1 },
      { id: 'crow-182', type: 'crow', x: 182, y: 3.0, z: 0, dir: -1 },
      { id: 'crab-198', type: 'crab', x: 198, y: 0, z: -1, dir: -1 },
      { id: 'crab-199.2', type: 'crab', x: 199.2, y: 0, z: -1, dir: -1 },
    ];

    // Decor
    const decor = [
      {
        id: 'decor-overhead-7',
        type: 'overheadBoard',
        x: 7,
        y: 5.2,
        z: 0,
        rotY: -Math.PI / 2,
        props: { lines: ['PLATFORM 1', '12620 MATSYAGANDHA EXP → MUMBAI LTT'] },
      },
      {
        id: 'decor-led-196',
        type: 'ledBoard',
        x: 196,
        y: 5.6,
        z: 0,
        rotY: -Math.PI / 2,
        props: { text: '12620 MATSYAGANDHA EXPRESS  •  PLATFORM 1  •  RIGHT TIME' },
      },
      { id: 'decor-wallboard-10', type: 'wallBoard', x: 10, y: 2.5, z: -3.95, rotY: 0, props: {} },
      { id: 'decor-wallboard-90', type: 'wallBoard', x: 90, y: 2.5, z: -3.95, rotY: 0, props: {} },
      { id: 'decor-wallboard-170', type: 'wallBoard', x: 170, y: 2.5, z: -3.95, rotY: 0, props: {} },
      { id: 'decor-wallboard-214', type: 'wallBoard', x: 214, y: 2.5, z: -3.95, rotY: 0, props: {} },
      { id: 'decor-farboard-30', type: 'farBoard', x: 30, y: 2.5, z: 14.4, rotY: Math.PI, props: {} },
      { id: 'decor-farboard-130', type: 'farBoard', x: 130, y: 2.5, z: 14.4, rotY: Math.PI, props: {} },
      { id: 'decor-poster-3', type: 'poster', x: 3, y: 2.0, z: -3.95, rotY: 0, props: { key: 'yakshagana' } },
      { id: 'decor-poster-17', type: 'poster', x: 17, y: 2.0, z: -3.95, rotY: 0, props: { key: 'kambala' } },
      { id: 'decor-poster-47', type: 'poster', x: 47, y: 2.0, z: -3.95, rotY: 0, props: { key: 'pilivesha' } },
      { id: 'decor-poster-66', type: 'poster', x: 66, y: 2.0, z: -3.95, rotY: 0, props: { key: 'gadbad' } },
      { id: 'decor-poster-96', type: 'poster', x: 96, y: 2.0, z: -3.95, rotY: 0, props: { key: 'panambur' } },
      { id: 'decor-poster-133', type: 'poster', x: 133, y: 2.0, z: -3.95, rotY: 0, props: { key: 'yakshagana' } },
      { id: 'decor-poster-162', type: 'poster', x: 162, y: 2.0, z: -3.95, rotY: 0, props: { key: 'kambala' } },
      { id: 'decor-poster-190', type: 'poster', x: 190, y: 2.0, z: -3.95, rotY: 0, props: { key: 'pilivesha' } },
      { id: 'decor-poster-228', type: 'poster', x: 228, y: 2.0, z: -3.95, rotY: 0, props: { key: 'gadbad' } },
      { id: 'decor-clock-12', type: 'clock', x: 12, y: 5.4, z: -3.95, rotY: 0, props: {} },
      { id: 'decor-clock-120', type: 'clock', x: 120, y: 5.4, z: -3.95, rotY: 0, props: {} },
      {
        id: 'decor-sign-68.5',
        type: 'sign',
        x: 68.5,
        y: 2.0,
        z: -3.95,
        rotY: 0,
        props: { lines: ['CAUTION', 'MONSOON DRAIN — MIND THE GAP'], style: 'caution' },
      },
      {
        id: 'decor-sign-136.5',
        type: 'sign',
        x: 136.5,
        y: 2.0,
        z: -3.95,
        rotY: 0,
        props: { lines: ['CAUTION', 'MONSOON DRAIN — MIND THE GAP'], style: 'caution' },
      },
      {
        id: 'decor-sign-184.5',
        type: 'sign',
        x: 184.5,
        y: 2.0,
        z: -3.95,
        rotY: 0,
        props: { lines: ['RUN!', 'HOLD SHIFT FOR A LONGER JUMP'], style: 'run' },
      },
      {
        id: 'decor-sign-112',
        type: 'sign',
        x: 112,
        y: 2.0,
        z: -3.95,
        rotY: 0,
        props: { lines: ['CHECKPOINT', 'HALFWAY DOWN PLATFORM 1'], style: 'info' },
      },
      { id: 'decor-signal-232', type: 'signal', x: 232, y: 0, z: 8.5, rotY: 0, props: {} },
      { id: 'decor-dustbin-15', type: 'dustbin', x: 15, y: 0, z: -3.6, rotY: 0, props: {} },
      { id: 'decor-dustbin-58', type: 'dustbin', x: 58, y: 0, z: -3.6, rotY: 0, props: {} },
      { id: 'decor-dustbin-103', type: 'dustbin', x: 103, y: 0, z: -3.6, rotY: 0, props: {} },
      { id: 'decor-dustbin-145', type: 'dustbin', x: 145, y: 0, z: -3.6, rotY: 0, props: {} },
      { id: 'decor-dustbin-226', type: 'dustbin', x: 226, y: 0, z: -3.6, rotY: 0, props: {} },
      { id: 'decor-watertap-34', type: 'waterTap', x: 34, y: 0, z: -3.5, rotY: 0, props: { label: 'DRINKING WATER' } },
    ];

    return {
      name: 'Mangaluru Central — Platform 1',
      playerStart: { x: 2, y: 0, z: 0, yaw: 0 },
      checkpoint: { x: 112, z: 0 },
      flag: { x: 218, z: 0, height: 11 },
      train: { rearX: 222, z: 6.0, cars: 8, doorX: 225.5 },
      sections: sections,
      pits: pits,
      solids: solids,
      blocks: blocks,
      cashews: cashews,
      enemies: enemies,
      decor: decor,
    };
  }

  /**
   * Returns an array of static collision boxes for all solids in the level.
   * @param {!Object} level Complete level descriptor.
   * @return {!Array<{aabb: {minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number}, ref: !Object}>}
   */
  function staticColliders(level) {
    const solids = level.solids;
    const colliders = [];
    for (let index = 0; index < solids.length; index++) {
      const solid = solids[index];
      const halfWidth = solid.w / 2;
      const halfDepth = solid.d / 2;
      const aabb = {
        minX: solid.x - halfWidth,
        maxX: solid.x + halfWidth,
        minY: solid.y,
        maxY: solid.y + solid.h,
        minZ: solid.z - halfDepth,
        maxZ: solid.z + halfDepth,
      };
      colliders.push({ aabb: aabb, ref: solid });
    }
    return colliders;
  }

  /**
   * Returns the top Y of the highest walkable platform or laterite solid
   * containing (x, z), or null if over a pit.
   * @param {!Object} level Complete level descriptor.
   * @param {number} x World X coordinate.
   * @param {number} z World Z coordinate.
   * @return {?number} Highest top Y or null.
   */
  function floorTopAt(level, x, z) {
    const solids = level.solids;
    let highestTop = null;
    for (let index = 0; index < solids.length; index++) {
      const solid = solids[index];
      if (solid.kind !== 'platform' && solid.kind !== 'laterite') {
        continue;
      }
      const halfWidth = solid.w / 2;
      const halfDepth = solid.d / 2;
      const minX = solid.x - halfWidth;
      const maxX = solid.x + halfWidth;
      const minZ = solid.z - halfDepth;
      const maxZ = solid.z + halfDepth;
      if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
        const topY = solid.y + solid.h;
        if (highestTop === null || topY > highestTop) {
          highestTop = topY;
        }
      }
    }
    return highestTop;
  }

  const Level = {
    create: create,
    staticColliders: staticColliders,
    floorTopAt: floorTopAt,
  };

  KUDLA.Level = Level;
  if (typeof module === 'object' && module.exports) {
    module.exports = Level;
  }
})(typeof window !== 'undefined' ? window : globalThis);
