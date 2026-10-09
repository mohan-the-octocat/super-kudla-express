/**
 * @fileoverview Procedural textures for Super Kudla Express.
 * Strictly implements DESIGN.md section 7.1. All textures use THREE.sRGBEncoding
 * and anisotropy 4. Every function caches and returns the same instance on repeat calls.
 */
(function (root) {
  'use strict';
  const KUDLA = (root.KUDLA = root.KUDLA || {});

  const textureCache = new Map();
  const iconCache = new Map();

  const FONT_KANNADA = '"Noto Sans Kannada", "Kannada Sangam MN", "Tunga", "Nirmala UI", sans-serif';
  const FONT_DEVANAGARI = '"Noto Sans Devanagari", "Kohinoor Devanagari", "Mangal", "Nirmala UI", sans-serif';
  const FONT_LATIN = '"Baloo 2", "Trebuchet MS", "Segoe UI", sans-serif';

  const POSTER_TITLES = {
    yakshagana: 'YAKSHAGANA · TONIGHT',
    kambala: 'KAMBALA · BUFFALO RACE',
    pilivesha: 'PILI VESHA · MANGALURU DASARA',
    gadbad: 'GADBAD ICE CREAM',
    panambur: 'PANAMBUR BEACH',
  };

  /**
   * Safe document element creator.
   * @param {string} tagName Tag name.
   * @return {?HTMLElement}
   */
  function createElementSafe(tagName) {
    if (typeof document !== 'undefined' && document.createElement) {
      return document.createElement(tagName);
    }
    return null;
  }

  /**
   * Builds a canvas, invokes draw callback, and wraps in THREE.CanvasTexture.
   * @param {number} width
   * @param {number} height
   * @param {function(!CanvasRenderingContext2D, number, number): void} draw
   * @param {!Object=} options
   * @return {!THREE.CanvasTexture}
   */
  function canvasTexture(width, height, draw, options) {
    const opts = options || {};
    if (opts.cacheKey && textureCache.has(opts.cacheKey)) {
      return textureCache.get(opts.cacheKey);
    }

    const canvas = createElementSafe('canvas');
    if (!canvas) {
      return null;
    }
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context && typeof draw === 'function') {
      draw(context, width, height);
    }

    const THREE = root.THREE || (typeof window !== 'undefined' ? window.THREE : globalThis.THREE);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 4;

    if (opts.repeat) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      if (Array.isArray(opts.repeat)) {
        texture.repeat.set(opts.repeat[0] || 1, opts.repeat[1] || 1);
      } else if (typeof opts.repeat === 'number') {
        texture.repeat.set(opts.repeat, opts.repeat);
      } else if (typeof opts.repeat === 'object') {
        texture.repeat.set(opts.repeat.x || 1, opts.repeat.y || 1);
      }
    }

    if (opts.cacheKey) {
      textureCache.set(opts.cacheKey, texture);
    }
    return texture;
  }

  /**
   * Helper to fetch palette safely at call time.
   * @return {!Object}
   */
  function getPalette() {
    return (KUDLA.Config && KUDLA.Config.PALETTE) || {};
  }

  // --- Block Faces (256x256) ---

  function drawTileBlock(context, width, height) {
    const palette = getPalette();
    const terracotta = palette.terracotta || '#C2512A';
    const terracottaDark = palette.terracottaDark || '#8E3A1E';
    const terracottaLight = palette.terracottaLight || '#E07A4F';

    context.fillStyle = terracotta;
    context.fillRect(0, 0, width, height);

    // Dark edge so it reads as a solid block
    context.strokeStyle = terracottaDark;
    context.lineWidth = 6;
    context.strokeRect(3, 3, width - 6, height - 6);

    // Two rows of overlapping tiles with dual lengthwise ribs and shadowed curved lips
    const rowHeight = Math.floor((height - 12) / 2);
    for (let rowIndex = 0; rowIndex < 2; rowIndex++) {
      const topY = 6 + rowIndex * rowHeight;
      const bottomY = topY + rowHeight;

      // Draw two tiles per row
      for (let colIndex = 0; colIndex < 2; colIndex++) {
        const leftX = 6 + colIndex * 122;
        const tileWidth = 120;

        // Tile base gradient
        const gradient = context.createLinearGradient(leftX, topY, leftX, bottomY);
        gradient.addColorStop(0, terracottaLight);
        gradient.addColorStop(0.85, terracotta);
        gradient.addColorStop(1, terracottaDark);
        context.fillStyle = gradient;
        context.fillRect(leftX + 2, topY + 2, tileWidth - 4, rowHeight - 4);

        // Two raised lengthwise ribs
        const rib1X = leftX + 32;
        const rib2X = leftX + 80;
        [rib1X, rib2X].forEach((ribX) => {
          context.fillStyle = terracottaLight;
          context.fillRect(ribX, topY + 4, 6, rowHeight - 16);
          context.fillStyle = terracottaDark;
          context.fillRect(ribX + 6, topY + 4, 3, rowHeight - 16);
        });

        // Curved shadowed lip at bottom
        context.beginPath();
        context.fillStyle = terracottaDark;
        context.ellipse(leftX + tileWidth / 2, bottomY - 4, tileWidth / 2 - 4, 6, 0, 0, Math.PI);
        context.fill();
      }
    }

    // Tiny oval maker's stamp in center
    context.fillStyle = terracottaDark;
    context.beginPath();
    context.ellipse(128, 64, 22, 12, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = terracottaLight;
    context.lineWidth = 1.5;
    context.stroke();
    context.fillStyle = terracottaLight;
    context.font = 'bold 9px ' + FONT_LATIN;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('KUDLA', 128, 64);
  }

  function drawMysteryBlock(context, width, height) {
    const palette = getPalette();
    const gold = palette.gold || '#F4B41A';
    const goldLight = palette.goldLight || '#FFD866';
    const goldDark = palette.goldDark || '#B9800C';

    context.fillStyle = gold;
    context.fillRect(0, 0, width, height);

    // Bevel edges
    context.fillStyle = goldLight;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(width, 0);
    context.lineTo(width - 16, 16);
    context.lineTo(16, 16);
    context.lineTo(16, height - 16);
    context.lineTo(0, height);
    context.closePath();
    context.fill();

    context.fillStyle = goldDark;
    context.beginPath();
    context.moveTo(width, height);
    context.lineTo(0, height);
    context.lineTo(16, height - 16);
    context.lineTo(width - 16, height - 16);
    context.lineTo(width - 16, 16);
    context.lineTo(width, 0);
    context.closePath();
    context.fill();

    // Four corner rivets
    const rivets = [
      [30, 30],
      [width - 30, 30],
      [30, height - 30],
      [width - 30, height - 30],
    ];
    rivets.forEach(([rx, ry]) => {
      context.beginPath();
      context.arc(rx, ry, 7, 0, Math.PI * 2);
      context.fillStyle = goldDark;
      context.fill();
      context.beginPath();
      context.arc(rx - 2, ry - 2, 3, 0, Math.PI * 2);
      context.fillStyle = goldLight;
      context.fill();
    });

    // Big dark-brown question mark with drop shadow
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '900 116px ' + FONT_LATIN;
    context.fillStyle = 'rgba(70, 35, 10, 0.4)';
    context.fillText('?', 132, 122);
    context.fillStyle = '#422008';
    context.fillText('?', 128, 118);

    // Small Kannada 'ದಾದ?' below it
    context.font = 'bold 28px ' + FONT_KANNADA;
    context.fillStyle = '#422008';
    context.fillText('ದಾದ?', 128, 196);
  }

  function drawUsedBlock(context, width, height) {
    const palette = getPalette();
    const usedColor = palette.usedBlock || '#6E4B33';
    const poreColor = palette.lateritePore || '#3F1A10';

    context.fillStyle = usedColor;
    context.fillRect(0, 0, width, height);

    // Bevel edges
    context.fillStyle = '#8A6044';
    context.fillRect(0, 0, width, 12);
    context.fillRect(0, 0, 12, height);
    context.fillStyle = '#463020';
    context.fillRect(0, height - 12, width, 12);
    context.fillRect(width - 12, 0, 12, height);

    // Dark pores
    context.fillStyle = poreColor;
    const poreCoords = [
      [45, 40, 9, 6], [180, 50, 14, 8], [90, 80, 12, 10], [140, 100, 8, 7],
      [50, 130, 15, 9], [210, 140, 10, 7], [85, 170, 13, 8], [175, 185, 16, 11],
      [130, 160, 9, 7], [120, 45, 7, 5], [70, 210, 11, 7], [195, 95, 8, 6],
    ];
    poreCoords.forEach(([px, py, pw, ph]) => {
      context.beginPath();
      context.ellipse(px, py, pw / 2, ph / 2, 0, 0, Math.PI * 2);
      context.fill();
    });
  }

  function drawLaterite(context, width, height) {
    const palette = getPalette();
    const lateriteColor = palette.laterite || '#A04A2E';
    const darkPore = palette.lateritePore || '#3F1A10';
    const lateriteDark = palette.lateriteDark || '#6B2D1B';
    const speckle = palette.terracottaLight || '#E07A4F';

    context.fillStyle = lateriteColor;
    context.fillRect(0, 0, width, height);

    // Coursed horizontal stone bands
    const courseHeight = height / 4;
    context.strokeStyle = lateriteDark;
    context.lineWidth = 4;
    for (let i = 1; i < 4; i++) {
      context.beginPath();
      context.moveTo(0, i * courseHeight);
      context.lineTo(width, i * courseHeight);
      context.stroke();
    }

    // Alternating vertical mortar lines (running bond)
    context.lineWidth = 3;
    for (let courseIndex = 0; courseIndex < 4; courseIndex++) {
      const cy = courseIndex * courseHeight;
      const midX = (courseIndex % 2 === 0) ? width / 2 : width / 4;
      context.beginPath();
      context.moveTo(midX, cy);
      context.lineTo(midX, cy + courseHeight);
      context.stroke();
      if (courseIndex % 2 !== 0) {
        context.beginPath();
        context.moveTo(midX + width / 2, cy);
        context.lineTo(midX + width / 2, cy + courseHeight);
        context.stroke();
      }
    }

    // Vesicular pores
    context.fillStyle = darkPore;
    for (let i = 0; i < 28; i++) {
      const px = (i * 37 + 19) % width;
      const py = (i * 53 + 23) % height;
      const radius = (i % 4) + 2;
      context.beginPath();
      context.arc(px, py, radius, 0, Math.PI * 2);
      context.fill();
    }

    // Light speckles
    context.fillStyle = speckle;
    for (let i = 0; i < 24; i++) {
      const sx = (i * 71 + 31) % width;
      const sy = (i * 43 + 17) % height;
      context.fillRect(sx, sy, 2, 2);
    }
  }

  // --- Environment Textures (512x512) ---

  function drawPlatformFloor(context, width, height) {
    const palette = getPalette();
    const stoneColor = palette.platformStone || '#B9B4AA';
    context.fillStyle = stoneColor;
    context.fillRect(0, 0, width, height);

    // Slabs grid (4x4)
    const slabSize = width / 4;
    context.strokeStyle = '#8E8980';
    context.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      context.beginPath();
      context.moveTo(i * slabSize, 0);
      context.lineTo(i * slabSize, height);
      context.moveTo(0, i * slabSize);
      context.lineTo(width, i * slabSize);
      context.stroke();
    }

    // Subtle stone flecks
    context.fillStyle = 'rgba(0, 0, 0, 0.06)';
    for (let i = 0; i < 60; i++) {
      context.fillRect((i * 47) % width, (i * 83) % height, 3, 3);
    }
  }

  function drawTactileStrip(context, width, height) {
    const palette = getPalette();
    const yellow = palette.tactileYellow || '#F2C200';
    context.fillStyle = yellow;
    context.fillRect(0, 0, width, height);

    // 8x8 raised blister dots with 3D highlight & shadow
    const dotSpacing = width / 8;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const cx = col * dotSpacing + dotSpacing / 2;
        const cy = row * dotSpacing + dotSpacing / 2;

        context.beginPath();
        context.arc(cx, cy, 14, 0, Math.PI * 2);
        context.fillStyle = '#B28A00';
        context.fill();

        context.beginPath();
        context.arc(cx - 2, cy - 2, 13, 0, Math.PI * 2);
        context.fillStyle = '#FFE033';
        context.fill();

        context.beginPath();
        context.arc(cx - 1, cy - 1, 11, 0, Math.PI * 2);
        context.fillStyle = yellow;
        context.fill();
      }
    }
  }

  function drawBallast(context, width, height) {
    const palette = getPalette();
    const baseColor = palette.ballast || '#7D7468';
    context.fillStyle = baseColor;
    context.fillRect(0, 0, width, height);

    const stoneColors = ['#5A5248', '#8E8578', '#6E665A', '#9A9084', '#4E463E'];
    for (let i = 0; i < 180; i++) {
      const bx = (i * 31) % (width - 24);
      const by = (i * 67) % (height - 24);
      const bwidth = 16 + (i % 12);
      const bheight = 14 + (i % 8);
      context.fillStyle = stoneColors[i % stoneColors.length];
      context.beginPath();
      context.moveTo(bx + 4, by);
      context.lineTo(bx + bwidth, by + 3);
      context.lineTo(bx + bwidth - 2, by + bheight);
      context.lineTo(bx + 2, by + bheight - 2);
      context.closePath();
      context.fill();
    }
  }

  function drawWallPlaster(context, width, height) {
    const palette = getPalette();
    const cream = palette.cream || '#F3E3C3';
    context.fillStyle = cream;
    context.fillRect(0, 0, width, height);

    // Weathering bands
    context.fillStyle = 'rgba(142, 47, 34, 0.04)';
    context.fillRect(0, height - 120, width, 120);

    // Plaster texture grain
    context.fillStyle = 'rgba(0, 0, 0, 0.03)';
    for (let i = 0; i < 120; i++) {
      context.fillRect((i * 73) % width, (i * 39) % height, 4, 2);
    }
  }

  function drawCanopyUnderside(context, width, height) {
    const palette = getPalette();
    const terracotta = palette.terracotta || '#A54522';
    context.fillStyle = terracotta;
    context.fillRect(0, 0, width, height);

    // Vertical dark wooden battens (rafters)
    const beamSpacing = width / 4;
    context.fillStyle = '#381E10';
    for (let i = 0; i <= 4; i++) {
      context.fillRect(i * beamSpacing - 8, 0, 16, height);
    }

    // Horizontal purlins
    context.fillStyle = '#4A2A18';
    for (let i = 0; i <= 4; i++) {
      context.fillRect(0, i * beamSpacing - 6, width, 12);
    }

    // Shading on tiles between beams
    context.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let i = 0; i < 4; i++) {
      context.fillRect(i * beamSpacing + 8, 0, 14, height);
    }
  }

  function drawRoofTiles(context, width, height) {
    const palette = getPalette();
    const terracotta = palette.terracotta || '#C2512A';
    const darkLip = palette.terracottaDark || '#8E3A1E';
    const lightRib = palette.terracottaLight || '#E07A4F';

    context.fillStyle = terracotta;
    context.fillRect(0, 0, width, height);

    const rows = 8;
    const rHeight = height / rows;
    for (let r = 0; r < rows; r++) {
      const ry = r * rHeight;
      // Shadowed overlap lip
      context.fillStyle = darkLip;
      context.fillRect(0, ry + rHeight - 6, width, 6);
      context.fillStyle = lightRib;
      context.fillRect(0, ry, width, 2);

      // Dual ribs across columns
      for (let c = 0; c < 8; c++) {
        const rx = c * (width / 8) + 16;
        context.fillStyle = lightRib;
        context.fillRect(rx, ry + 2, 4, rHeight - 8);
        context.fillRect(rx + 20, ry + 2, 4, rHeight - 8);
        context.fillStyle = darkLip;
        context.fillRect(rx + 4, ry + 2, 2, rHeight - 8);
        context.fillRect(rx + 24, ry + 2, 2, rHeight - 8);
      }
    }
  }

  function drawBoundaryWall(context, width, height) {
    drawLaterite(context, width, height);

    // Mortar lines
    context.strokeStyle = '#5E4E42';
    context.lineWidth = 4;
    for (let i = 1; i < 4; i++) {
      context.beginPath();
      context.moveTo(0, i * (height / 4));
      context.lineTo(width, i * (height / 4));
      context.stroke();
    }

    // Green moss patches along bottom and select joints
    const palette = getPalette();
    const mossLight = palette.leaf || '#3E8E41';
    const mossDark = palette.leafDark || '#2A6430';
    for (let i = 0; i < 30; i++) {
      const mx = (i * 61) % width;
      const my = height - 40 + ((i * 17) % 36);
      context.fillStyle = (i % 2 === 0) ? mossLight : mossDark;
      context.beginPath();
      context.ellipse(mx, my, 12, 6, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawWater(context, width, height) {
    const palette = getPalette();
    const waterDark = palette.water || '#2E5E5A';
    context.fillStyle = waterDark;
    context.fillRect(0, 0, width, height);

    // Ripple sine waves
    const waves = 12;
    for (let w = 0; w < waves; w++) {
      const baseWaveY = (w * (height / waves)) + 15;
      context.beginPath();
      for (let x = 0; x <= width; x += 10) {
        const wy = baseWaveY + Math.sin(x * 0.05 + w) * 6;
        if (x === 0) {
          context.moveTo(x, wy);
        } else {
          context.lineTo(x, wy);
        }
      }
      context.strokeStyle = (w % 2 === 0) ? '#437F7A' : '#5CA49D';
      context.lineWidth = 3;
      context.stroke();
    }
  }

  // --- Signage ---

  function drawStationNameBoard(context, width, height) {
    const palette = getPalette();
    const yellow = palette.irYellow || '#FFD100';
    const ink = palette.ink || '#151515';

    context.fillStyle = yellow;
    context.fillRect(0, 0, width, height);

    // Black border
    context.strokeStyle = ink;
    context.lineWidth = 16;
    context.strokeRect(16, 16, width - 32, height - 32);

    context.fillStyle = ink;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Three centred lines
    context.font = 'bold 58px ' + FONT_KANNADA;
    context.fillText('ಮಂಗಳೂರು ಸೆಂಟ್ರಲ್', width / 2, 95);

    context.font = 'bold 52px ' + FONT_DEVANAGARI;
    context.fillText('मंगलूरु सेंट्रल', width / 2, 195);

    context.font = 'bold 62px ' + FONT_LATIN;
    context.fillText('MANGALURU CENTRAL', width / 2, 300);
  }

  function drawTextBoard(context, width, height, lines, options) {
    const opts = options || {};
    const palette = getPalette();
    const bg = opts.bg || palette.irYellow || '#FFD100';
    const fg = opts.fg || palette.ink || '#151515';
    const border = opts.border || fg;

    context.fillStyle = bg;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = border;
    context.lineWidth = 10;
    context.strokeRect(8, 8, width - 16, height - 16);

    context.fillStyle = fg;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = 'bold 46px ' + FONT_LATIN;

    const lineCount = lines.length;
    lines.forEach((lineText, index) => {
      const lineY = (height / (lineCount + 1)) * (index + 1);
      context.fillText(String(lineText), width / 2, lineY);
    });
  }

  function drawLedBoard(context, width, height, text) {
    const palette = getPalette();
    const amber = palette.ledAmber || '#FFB000';

    context.fillStyle = '#080808';
    context.fillRect(0, 0, width, height);

    // Dot matrix grid background
    context.fillStyle = '#1C1200';
    for (let gy = 6; gy < height; gy += 8) {
      for (let gx = 6; gx < width; gx += 8) {
        context.fillRect(gx, gy, 3, 3);
      }
    }

    // Glowing dot-matrix style text
    context.fillStyle = amber;
    context.shadowColor = '#FF9500';
    context.shadowBlur = 10;
    context.font = 'bold 52px "Courier New", monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(text), width / 2, height / 2);
    context.shadowBlur = 0;
  }

  // --- Posters ---

  function drawPosterBand(context, titleText, bx, by, bwidth, bheight) {
    context.fillStyle = '#111116';
    context.fillRect(bx, by, bwidth, bheight);

    context.strokeStyle = '#FFD100';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(bx, by);
    context.lineTo(bx + bwidth, by);
    context.stroke();

    context.fillStyle = '#FFFFFF';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = 'bold 28px ' + FONT_LATIN;
    context.fillText(titleText, bx + bwidth / 2, by + bheight / 2);
  }

  function drawPosterFallback(context, posterKey, width, height) {
    // Rich graphic procedural art per poster topic
    if (posterKey === 'yakshagana') {
      context.fillStyle = '#6B0A0A';
      context.fillRect(0, 0, width, height);
      // Gold ornate crown and face
      context.fillStyle = '#F4B41A';
      context.beginPath();
      context.arc(width / 2, height * 0.45, 120, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#151515';
      context.beginPath();
      context.arc(width / 2, height * 0.52, 70, 0, Math.PI);
      context.fill();
    } else if (posterKey === 'kambala') {
      context.fillStyle = '#3E2723';
      context.fillRect(0, 0, width, height);
      // Twin black buffaloes racing in water
      context.fillStyle = '#D7CCC8';
      context.fillRect(0, height * 0.65, width, height * 0.35);
      context.fillStyle = '#1A1A1A';
      context.fillRect(width * 0.15, height * 0.45, 140, 90);
      context.fillRect(width * 0.55, height * 0.45, 140, 90);
    } else if (posterKey === 'pilivesha') {
      context.fillStyle = '#FF9800';
      context.fillRect(0, 0, width, height);
      // Tiger stripes
      context.fillStyle = '#1A1A1A';
      for (let i = 0; i < 8; i++) {
        context.beginPath();
        const sy = i * 75 + 30;
        context.moveTo(0, sy);
        context.lineTo(160, sy + 25);
        context.lineTo(0, sy + 50);
        context.fill();
        context.beginPath();
        context.moveTo(width, sy + 30);
        context.lineTo(width - 160, sy + 55);
        context.lineTo(width, sy + 80);
        context.fill();
      }
    } else if (posterKey === 'gadbad') {
      context.fillStyle = '#4A148C';
      context.fillRect(0, 0, width, height);
      // Layered sundae glass graphic
      const layers = ['#3E2723', '#4CAF50', '#FFEB3B', '#E91E63'];
      layers.forEach((color, index) => {
        context.fillStyle = color;
        context.fillRect(width * 0.28, height * 0.3 + index * 55, width * 0.44, 50);
      });
      // Cherry
      context.fillStyle = '#D50000';
      context.beginPath();
      context.arc(width / 2, height * 0.24, 28, 0, Math.PI * 2);
      context.fill();
    } else {
      // panambur beach
      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#FF6F00');
      gradient.addColorStop(0.5, '#FFE082');
      gradient.addColorStop(1, '#00695C');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      // White sun / lighthouse silhouette
      context.fillStyle = '#FFF8E1';
      context.beginPath();
      context.arc(width * 0.35, height * 0.35, 45, 0, Math.PI * 2);
      context.fill();
    }
  }

  // --- HUD Icons (96x96) ---

  function drawIconGraphic(context, iconName, width, height) {
    const palette = getPalette();
    context.clearRect(0, 0, width, height);

    // Dark circular background badge
    context.fillStyle = '#1A1816';
    context.beginPath();
    context.arc(width / 2, height / 2, 44, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#4A423A';
    context.lineWidth = 3;
    context.stroke();

    const cx = width / 2;
    const cy = height / 2;

    if (iconName === 'cashew') {
      context.fillStyle = palette.cashew || '#E9B949';
      context.beginPath();
      context.ellipse(cx, cy, 22, 14, 0.4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#FFF2A8';
      context.beginPath();
      context.arc(cx - 6, cy - 4, 5, 0, Math.PI * 2);
      context.fill();
    } else if (iconName === 'buns') {
      context.fillStyle = palette.leaf || '#3E8E41';
      context.fillRect(cx - 28, cy + 6, 56, 16);
      context.fillStyle = '#D48C38';
      context.beginPath();
      context.arc(cx, cy - 2, 22, 0, Math.PI * 2);
      context.fill();
    } else if (iconName === 'gheeroast') {
      context.fillStyle = '#D4AF37';
      context.fillRect(cx - 24, cy, 48, 20);
      context.fillStyle = palette.chilli || '#D7261E';
      context.beginPath();
      context.arc(cx, cy - 4, 18, Math.PI, 0);
      context.fill();
    } else if (iconName === 'gadbad') {
      const colors = ['#3E2723', '#4CAF50', '#FFEB3B', '#E91E63'];
      colors.forEach((col, idx) => {
        context.fillStyle = col;
        context.fillRect(cx - 14, cy - 18 + idx * 9, 28, 8);
      });
      context.fillStyle = '#D50000';
      context.beginPath();
      context.arc(cx, cy - 23, 6, 0, Math.PI * 2);
      context.fill();
    } else if (iconName === 'coconut') {
      context.fillStyle = '#388E3C';
      context.beginPath();
      context.arc(cx, cy + 2, 24, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#FFF8DC';
      context.fillRect(cx - 10, cy - 22, 20, 6);
      context.strokeStyle = '#D7261E';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(cx + 4, cy - 18);
      context.lineTo(cx + 14, cy - 32);
      context.stroke();
    } else if (iconName === 'denji') {
      context.fillStyle = palette.crab || '#E2572B';
      context.beginPath();
      context.ellipse(cx, cy + 4, 24, 15, 0, 0, Math.PI * 2);
      context.fill();
      // Eye stalks
      context.fillStyle = '#FFFFFF';
      context.fillRect(cx - 10, cy - 14, 6, 8);
      context.fillRect(cx + 4, cy - 14, 6, 8);
      context.fillStyle = '#000000';
      context.fillRect(cx - 8, cy - 12, 3, 3);
      context.fillRect(cx + 6, cy - 12, 3, 3);
    } else if (iconName === 'crow') {
      context.fillStyle = palette.crow || '#1B1B1F';
      context.beginPath();
      context.ellipse(cx, cy, 22, 14, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = palette.crowNape || '#6C6F75';
      context.fillRect(cx + 4, cy - 8, 8, 14);
      context.fillStyle = '#151515';
      context.beginPath();
      context.moveTo(cx + 16, cy - 4);
      context.lineTo(cx + 28, cy);
      context.lineTo(cx + 16, cy + 4);
      context.closePath();
      context.fill();
    } else if (iconName === 'tile') {
      drawTileBlock(context, width, height);
    } else if (iconName === 'mystery') {
      drawMysteryBlock(context, width, height);
    } else if (iconName === 'laterite') {
      drawLaterite(context, width, height);
    } else {
      context.fillStyle = '#FFFFFF';
      context.font = 'bold 36px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('?', cx, cy);
    }
  }

  // --- Public API ---

  const Textures = {
    canvasTexture,

    tileBlock() {
      return canvasTexture(256, 256, drawTileBlock, { cacheKey: 'block_tile' });
    },

    mysteryBlock() {
      return canvasTexture(256, 256, drawMysteryBlock, { cacheKey: 'block_mystery' });
    },

    usedBlock() {
      return canvasTexture(256, 256, drawUsedBlock, { cacheKey: 'block_used' });
    },

    laterite() {
      return canvasTexture(256, 256, drawLaterite, { cacheKey: 'block_laterite', repeat: [1, 1] });
    },

    platformFloor() {
      return canvasTexture(512, 512, drawPlatformFloor, { cacheKey: 'env_platformFloor', repeat: [1, 1] });
    },

    tactileStrip() {
      return canvasTexture(512, 512, drawTactileStrip, { cacheKey: 'env_tactileStrip', repeat: [1, 1] });
    },

    ballast() {
      return canvasTexture(512, 512, drawBallast, { cacheKey: 'env_ballast', repeat: [1, 1] });
    },

    wallPlaster() {
      return canvasTexture(512, 512, drawWallPlaster, { cacheKey: 'env_wallPlaster', repeat: [1, 1] });
    },

    canopyUnderside() {
      return canvasTexture(512, 512, drawCanopyUnderside, { cacheKey: 'env_canopyUnderside', repeat: [1, 1] });
    },

    roofTiles() {
      return canvasTexture(512, 512, drawRoofTiles, { cacheKey: 'env_roofTiles', repeat: [1, 1] });
    },

    boundaryWall() {
      return canvasTexture(512, 512, drawBoundaryWall, { cacheKey: 'env_boundaryWall', repeat: [1, 1] });
    },

    water() {
      return canvasTexture(512, 512, drawWater, { cacheKey: 'env_water', repeat: [1, 1] });
    },

    stationNameBoard() {
      return canvasTexture(1024, 384, drawStationNameBoard, { cacheKey: 'sign_stationNameBoard' });
    },

    textBoard(lines, options) {
      const opts = options || {};
      const width = opts.width || 1024;
      const height = opts.height || 256;
      const cacheKey = 'sign_textBoard_' + width + '_' + height + '_' + (lines || []).join('__') + '_' + (opts.bg || '') + '_' + (opts.fg || '');
      return canvasTexture(width, height, (context) => {
        drawTextBoard(context, width, height, lines || [], opts);
      }, { cacheKey });
    },

    ledBoard(text) {
      const stringText = String(text || '');
      const cacheKey = 'sign_ledBoard_' + stringText;
      return canvasTexture(1024, 128, (context) => {
        drawLedBoard(context, 1024, 128, stringText);
      }, { cacheKey });
    },

    poster(key) {
      const posterKey = String(key || '');
      const cacheKey = 'poster_' + posterKey;
      if (textureCache.has(cacheKey)) {
        return textureCache.get(cacheKey);
      }

      const width = 512;
      const height = 768;
      const bandHeight = Math.floor(height * 0.18);
      const mainHeight = height - bandHeight;
      const titleText = POSTER_TITLES[posterKey] || posterKey.toUpperCase();

      const texture = canvasTexture(width, height, (context) => {
        drawPosterFallback(context, posterKey, width, mainHeight);
        drawPosterBand(context, titleText, 0, mainHeight, width, bandHeight);
      }, { cacheKey });

      const canvas = texture ? texture.image : null;
      if (canvas) {
        canvas._textures = canvas._textures || new Set();
        canvas._textures.add(texture);
        const originalClone = texture.clone;
        texture.clone = function () {
          const cloned = originalClone.call(this);
          if (canvas._textures) {
            canvas._textures.add(cloned);
          }
          return cloned;
        };
      }

      // Guarded async update if KUDLA.POSTERS is available
      const posters = (root.KUDLA && root.KUDLA.POSTERS) || null;
      if (posters && posters[posterKey] && typeof Image !== 'undefined') {
        const imageElement = new Image();
        const handleImageLoaded = () => {
          if (canvas) {
            const context = canvas.getContext('2d');
            if (context) {
              context.drawImage(imageElement, 0, 0, width, mainHeight);
              drawPosterBand(context, titleText, 0, mainHeight, width, bandHeight);
              if (canvas._textures) {
                canvas._textures.forEach((tex) => {
                  tex.needsUpdate = true;
                });
              } else {
                texture.needsUpdate = true;
              }
            }
          }
        };
        imageElement.onload = handleImageLoaded;
        imageElement.src = posters[posterKey];
        if (imageElement.complete) {
          handleImageLoaded();
        }
      }

      return texture;
    },

    icon(name) {
      const iconName = String(name || '');
      if (iconCache.has(iconName)) {
        return iconCache.get(iconName);
      }

      const canvas = createElementSafe('canvas');
      if (!canvas) {
        return null;
      }
      canvas.width = 96;
      canvas.height = 96;
      const context = canvas.getContext('2d');
      if (context) {
        drawIconGraphic(context, iconName, 96, 96);
      }
      iconCache.set(iconName, canvas);
      return canvas;
    },
  };

  KUDLA.Textures = Textures;
  if (typeof module === 'object' && module.exports) {
    module.exports = Textures;
  }
})(typeof window !== 'undefined' ? window : globalThis);
