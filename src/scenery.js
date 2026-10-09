/**
 * @fileoverview Complete static and ambient 3D environment for Super Kudla Express.
 * Strictly implements DESIGN.md §7.3 and §4.
 * Set on Platform 1 of Mangaluru Central (MAQ) railway station.
 * Pure scene graph construction: no renderer or DOM access so it executes in Node.js.
 */
(function (root) {
  'use strict';
  const KUDLA = (root.KUDLA = root.KUDLA || {});

  function getThree() {
    return root.THREE || (typeof window !== 'undefined' ? window.THREE : globalThis.THREE);
  }

  function getConfig() {
    return (root.KUDLA && root.KUDLA.Config) || {};
  }

  function getTextures() {
    return (root.KUDLA && root.KUDLA.Textures) || {};
  }

  function getPalette() {
    const config = getConfig();
    return (config && config.PALETTE) || {};
  }

  /**
   * Helper to create a cloned texture with specific repeat values.
   * Clones preserve image source while allowing independent UV repeat & offset.
   * @param {?THREE.Texture} baseTexture
   * @param {number} repeatX
   * @param {number} repeatY
   * @return {?THREE.Texture}
   */
  function createRepeatTexture(baseTexture, repeatX, repeatY) {
    if (!baseTexture) {
      return null;
    }
    const THREE = getThree();
    const cloned = baseTexture.clone();
    if (baseTexture.image && baseTexture.image._textures) {
      baseTexture.image._textures.add(cloned);
    }
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    cloned.repeat.set(repeatX, repeatY);
    cloned.needsUpdate = true;
    return cloned;
  }

  /**
   * Merges multiple BufferGeometries into a single non-indexed BufferGeometry.
   * Flat at module scope per Google3 craftsmanship rules.
   * @param {!Array<!THREE.BufferGeometry>} geometries
   * @return {!THREE.BufferGeometry}
   */
  function mergeBufferGeometries(geometries) {
    const THREE = getThree();
    const merged = new THREE.BufferGeometry();
    const positionList = [];
    const normalList = [];
    const uvList = [];

    geometries.forEach((geometry) => {
      const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
      const posAttr = nonIndexed.attributes.position;
      const normAttr = nonIndexed.attributes.normal;
      const uvAttr = nonIndexed.attributes.uv;
      for (let i = 0; i < posAttr.count; i++) {
        positionList.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        if (normAttr) {
          normalList.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
        }
        if (uvAttr) {
          uvList.push(uvAttr.getX(i), uvAttr.getY(i));
        }
      }
    });

    merged.setAttribute('position', new THREE.Float32BufferAttribute(positionList, 3));
    if (normalList.length > 0) {
      merged.setAttribute('normal', new THREE.Float32BufferAttribute(normalList, 3));
    }
    if (uvList.length > 0) {
      merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvList, 2));
    }
    return merged;
  }

  /**
   * Builds the cream window frame, dividers, and protruding sill geometry.
   * Flat at module scope per Google3 craftsmanship rules.
   * @return {!THREE.BufferGeometry}
   */
  function buildWindowFrameGeometry() {
    const THREE = getThree();
    const leftJamb = new THREE.BoxGeometry(0.12, 2.0, 0.06);
    leftJamb.translate(-0.64, 0, 0.02);
    const rightJamb = new THREE.BoxGeometry(0.12, 2.0, 0.06);
    rightJamb.translate(0.64, 0, 0.02);
    const topLintel = new THREE.BoxGeometry(1.40, 0.14, 0.06);
    topLintel.translate(0, 0.93, 0.02);
    const bottomSill = new THREE.BoxGeometry(1.56, 0.08, 0.12);
    bottomSill.translate(0, -0.96, 0.04);
    const mullion = new THREE.BoxGeometry(0.08, 1.80, 0.05);
    mullion.translate(0, 0, 0.015);
    const transom = new THREE.BoxGeometry(1.20, 0.08, 0.05);
    transom.translate(0, 0.20, 0.015);

    return mergeBufferGeometries([leftJamb, rightJamb, topLintel, bottomSill, mullion, transom]);
  }

  /**
   * Builds the dark-green louvred infill geometry with angled horizontal slats.
   * Flat at module scope per Google3 craftsmanship rules.
   * @return {!THREE.BufferGeometry}
   */
  function buildWindowInfillGeometry() {
    const THREE = getThree();
    const infillParts = [];
    const backingPane = new THREE.BoxGeometry(1.20, 1.76, 0.03);
    backingPane.translate(0, 0, -0.005);
    infillParts.push(backingPane);

    const slatYCoords = [-0.65, -0.45, -0.25, -0.05, 0.35, 0.55, 0.75];
    slatYCoords.forEach((slatY) => {
      const slat = new THREE.BoxGeometry(1.18, 0.04, 0.04);
      slat.rotateX(0.35);
      slat.translate(0, slatY, 0.01);
      infillParts.push(slat);
    });

    return mergeBufferGeometries(infillParts);
  }

  /**
   * Builds reserved X intervals from wall-mounted decor and stall/bench solids.
   * Flat at module scope per Google3 craftsmanship rules.
   * @param {!Object} level Level object.
   * @return {!Array<!{minX: number, maxX: number}>}
   */
  function buildReservedIntervals(level) {
    const intervals = [];
    const decorList = level.decor || [];
    const solidsList = level.solids || [];

    const decorHalfWidths = {
      wallBoard: 1.8,
      poster: 0.64,
      sign: 0.8,
      clock: 0.55,
      waterTap: 0.45,
    };

    decorList.forEach((item) => {
      const hw = decorHalfWidths[item.type];
      if (hw !== undefined) {
        const margin = 0.5;
        intervals.push({
          minX: item.x - hw - margin,
          maxX: item.x + hw + margin,
        });
      }
    });

    solidsList.forEach((solid) => {
      if (solid.kind === 'stall' || solid.kind === 'bench') {
        const hw = (solid.w || 1.0) / 2;
        const margin = 0.5;
        intervals.push({
          minX: solid.x - hw - margin,
          maxX: solid.x + hw + margin,
        });
      }
    });

    return intervals;
  }

  /**
   * Checks whether the interval [minX, maxX] intersects any reserved intervals.
   * Flat at module scope per Google3 craftsmanship rules.
   * @param {number} minX
   * @param {number} maxX
   * @param {!Array<!{minX: number, maxX: number}>} intervals
   * @return {boolean}
   */
  function isRangeIntersecting(minX, maxX, intervals) {
    for (let index = 0; index < intervals.length; index++) {
      const interval = intervals[index];
      if (maxX > interval.minX && minX < interval.maxX) {
        return true;
      }
    }
    return false;
  }

  /**
   * Finds the nearest X position to targetX where [x - halfWidth, x + halfWidth] does not
   * intersect any reserved interval. Searches outward alternately left and right.
   * Flat at module scope per Google3 craftsmanship rules.
   * @param {number} targetX
   * @param {number} halfWidth
   * @param {!Array<!{minX: number, maxX: number}>} intervals
   * @param {number} minBoundX
   * @param {number} maxBoundX
   * @return {number}
   */
  function findClearPosition(targetX, halfWidth, intervals, minBoundX, maxBoundX) {
    if (!isRangeIntersecting(targetX - halfWidth, targetX + halfWidth, intervals)) {
      return targetX;
    }
    for (let step = 0.2; step <= 25.0; step += 0.2) {
      const leftX = targetX - step;
      if (leftX >= minBoundX && !isRangeIntersecting(leftX - halfWidth, leftX + halfWidth, intervals)) {
        return leftX;
      }
      const rightX = targetX + step;
      if (rightX <= maxBoundX && !isRangeIntersecting(rightX - halfWidth, rightX + halfWidth, intervals)) {
        return rightX;
      }
    }
    return targetX;
  }

  /**
   * Builds the complete static and ambient 3D environment for Platform 1 of
   * Mangaluru Central station into the provided Three.js scene.
   * @param {!THREE.Scene} scene The target Three.js scene.
   * @param {!Object} level Level data object as returned by KUDLA.Level.create().
   * @return {!{
   *   sun: !THREE.DirectionalLight,
   *   standingTrain: !THREE.Group,
   *   flagPole: !THREE.Group,
   *   update: function(number, number, !{x: number, y: number, z: number}): !{horn: boolean, rumble: number}
   * }}
   */
  function build(scene, level) {
    const THREE = getThree();
    const config = getConfig();
    const textures = getTextures();
    const palette = getPalette();
    const geometryConfig = config.GEOMETRY || {};
    const goodsTrainConfig = config.GOODS_TRAIN || {};
    const trainConfig = config.TRAIN || {};

    // -------------------------------------------------------------------------
    // 1. SKY DOME, SUN DISC, AND DRIFTING CLOUDS
    // -------------------------------------------------------------------------
    const skyRadius = 450;
    const skyGeometry = new THREE.SphereGeometry(skyRadius, 32, 32);
    const skyPositionAttr = skyGeometry.attributes.position;
    const skyColors = [];
    const colorHorizon = new THREE.Color('#FDE7C8');
    const colorLowerBlue = new THREE.Color('#CFE6F7');
    const colorMidBlue = new THREE.Color('#7DB9EC');
    const colorZenithBlue = new THREE.Color('#3F8FDB');
    const tempColor = new THREE.Color();

    for (let index = 0; index < skyPositionAttr.count; index++) {
      const vertexY = skyPositionAttr.getY(index);
      const elevationRad = Math.asin(Math.max(-1, Math.min(1, vertexY / skyRadius)));
      const elevationDeg = elevationRad * (180 / Math.PI);
      if (elevationDeg <= 0) {
        tempColor.copy(colorHorizon);
      } else if (elevationDeg <= 6) {
        const fraction = elevationDeg / 6;
        tempColor.copy(colorHorizon).lerp(colorLowerBlue, fraction);
      } else if (elevationDeg <= 22) {
        const fraction = (elevationDeg - 6) / (22 - 6);
        tempColor.copy(colorLowerBlue).lerp(colorMidBlue, fraction);
      } else {
        const fraction = Math.min(1, (elevationDeg - 22) / (90 - 22));
        tempColor.copy(colorMidBlue).lerp(colorZenithBlue, fraction);
      }
      skyColors.push(tempColor.r, tempColor.g, tempColor.b);
    }
    skyGeometry.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));

    const skyMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
    skyMesh.name = 'skyDome';
    skyMesh.renderOrder = -10;
    skyMesh.frustumCulled = false;
    skyMesh.castShadow = false;
    skyMesh.receiveShadow = false;
    scene.add(skyMesh);

    // Glowing sun disc in sky
    const sunOffset = { x: -200, y: 320, z: 160 };
    const sunDiscGeo = new THREE.CircleGeometry(16, 24);
    const sunDiscMat = new THREE.MeshBasicMaterial({
      color: '#FFF2C6',
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    });
    const sunDiscMesh = new THREE.Mesh(sunDiscGeo, sunDiscMat);
    sunDiscMesh.position.set(sunOffset.x, sunOffset.y, sunOffset.z);
    sunDiscMesh.lookAt(0, 0, 0);
    sunDiscMesh.castShadow = false;
    scene.add(sunDiscMesh);

    // Drifting clouds group
    // Placed at 25-45 degrees elevation within radius < 450
    // Example: radius ~ 220 to 280, elevation 30 to 38 deg -> y ~ 110 to 160, x/z in [-180, 180]
    const cloudsGroup = new THREE.Group();
    cloudsGroup.name = 'cloudsGroup';
    const cloudSpheres = [];
    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: '#FFFFFF',
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      fog: false,
    });
    const cloudOffsets = [
      { x: -140, y: 130, z: -100, scaleX: 34, scaleZ: 20 },
      { x: -70, y: 145, z: 120, scaleX: 38, scaleZ: 22 },
      { x: 0, y: 135, z: -130, scaleX: 30, scaleZ: 18 },
      { x: 80, y: 150, z: 100, scaleX: 42, scaleZ: 24 },
      { x: 150, y: 125, z: -90, scaleX: 32, scaleZ: 19 },
      { x: 210, y: 140, z: 110, scaleX: 40, scaleZ: 22 },
    ];
    for (let index = 0; index < cloudOffsets.length; index++) {
      const offsetSpec = cloudOffsets[index];
      const singleCloudGroup = new THREE.Group();
      singleCloudGroup.position.set(offsetSpec.x, offsetSpec.y, offsetSpec.z);
      const puffGeo = new THREE.SphereGeometry(1, 8, 6);
      puffGeo.scale(offsetSpec.scaleX, 6, offsetSpec.scaleZ);
      const puffMesh = new THREE.Mesh(puffGeo, cloudMaterial);
      puffMesh.castShadow = false;
      singleCloudGroup.add(puffMesh);
      cloudsGroup.add(singleCloudGroup);
      cloudSpheres.push(singleCloudGroup);
    }
    scene.add(cloudsGroup);

    // Scene background fallback and fog matching sky horizon per DESIGN.md §7.3
    scene.background = new THREE.Color('#7DB9EC');
    scene.fog = new THREE.Fog('#FDE7C8', 70, 320);

    // -------------------------------------------------------------------------
    // 2. LIGHTING (SUN SHADOW CONFIG STRICTLY PER DESIGN.md §7.3)
    // -------------------------------------------------------------------------
    const hemiLight = new THREE.HemisphereLight('#CFE8FF', '#8A6A4A', 0.8);
    hemiLight.name = 'hemiLight';
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight('#FFE2B0', 1.05);
    sun.name = 'sunLight';
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 150;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;

    const sunTarget = new THREE.Object3D();
    sunTarget.name = 'sunTarget';
    sunTarget.position.set(2, 0, 0);
    scene.add(sunTarget);
    sun.target = sunTarget;
    sun.position.set(-28, 50, 25);
    scene.add(sun);

    // -------------------------------------------------------------------------
    // 3. BALLAST BED AND TRACKS 1 & 2
    // -------------------------------------------------------------------------
    const railTopY = geometryConfig.RAIL_TOP_Y !== undefined ? geometryConfig.RAIL_TOP_Y : -0.9;
    const ballastY = geometryConfig.BALLAST_Y !== undefined ? geometryConfig.BALLAST_Y : -1.2;
    const track1Z = geometryConfig.TRACK1_Z !== undefined ? geometryConfig.TRACK1_Z : 6.0;
    const track2Z = geometryConfig.TRACK2_Z !== undefined ? geometryConfig.TRACK2_Z : 11.0;
    const gauge = geometryConfig.GAUGE !== undefined ? geometryConfig.GAUGE : 1.676;

    // Ballast bed plane covering both tracks
    const ballastWidth = 11.5;
    const ballastLength = 320;
    const ballastCenterX = 115;
    const ballastCenterZ = (track1Z + track2Z) / 2;
    const ballastGeo = new THREE.BoxGeometry(ballastLength, 0.4, ballastWidth);
    const ballastMat = new THREE.MeshStandardMaterial({
      map: createRepeatTexture(textures.ballast ? textures.ballast() : null, ballastLength / 2.0, ballastWidth / 2.0),
      roughness: 0.95,
      metalness: 0.0,
    });
    const ballastMesh = new THREE.Mesh(ballastGeo, ballastMat);
    ballastMesh.position.set(ballastCenterX, ballastY - 0.2, ballastCenterZ);
    ballastMesh.receiveShadow = true;
    scene.add(ballastMesh);

    // Instanced concrete sleepers for Track 1 and Track 2
    const sleeperSpacing = 0.6;
    const sleeperStartX = -35;
    const sleeperEndX = 265;
    const sleeperCountPerTrack = Math.floor((sleeperEndX - sleeperStartX) / sleeperSpacing);
    const totalSleepers = sleeperCountPerTrack * 2;

    const sleeperGeo = new THREE.BoxGeometry(0.24, 0.20, 2.70);
    const sleeperMat = new THREE.MeshStandardMaterial({
      color: palette.sleeper || '#A19E97',
      roughness: 0.9,
    });
    const sleeperInstancedMesh = new THREE.InstancedMesh(sleeperGeo, sleeperMat, totalSleepers);
    sleeperInstancedMesh.receiveShadow = true;
    sleeperInstancedMesh.castShadow = false;

    const dummyMatrix = new THREE.Object3D();
    let sleeperIndex = 0;

    for (let trackNum = 0; trackNum < 2; trackNum++) {
      const tz = trackNum === 0 ? track1Z : track2Z;
      for (let i = 0; i < sleeperCountPerTrack; i++) {
        const sx = sleeperStartX + i * sleeperSpacing;
        dummyMatrix.position.set(sx, ballastY + 0.10, tz);
        dummyMatrix.rotation.set(0, 0, 0);
        dummyMatrix.scale.set(1, 1, 1);
        dummyMatrix.updateMatrix();
        sleeperInstancedMesh.setMatrixAt(sleeperIndex, dummyMatrix.matrix);
        sleeperIndex++;
      }
    }
    sleeperInstancedMesh.instanceMatrix.needsUpdate = true;
    scene.add(sleeperInstancedMesh);

    // Steel rails (two per track)
    const railSteelMat = new THREE.MeshStandardMaterial({
      color: palette.railSteel || '#8A8F96',
      metalness: 0.65,
      roughness: 0.25,
    });
    const railHeight = railTopY - (ballastY + 0.20);
    const railCenterY = (railTopY + ballastY + 0.20) / 2;
    const railGeo = new THREE.BoxGeometry(ballastLength, railHeight, 0.07);

    const railZCoords = [
      track1Z - gauge / 2,
      track1Z + gauge / 2,
      track2Z - gauge / 2,
      track2Z + gauge / 2,
    ];
    for (let index = 0; index < railZCoords.length; index++) {
      const railMesh = new THREE.Mesh(railGeo, railSteelMat);
      railMesh.position.set(ballastCenterX, railCenterY, railZCoords[index]);
      railMesh.receiveShadow = true;
      scene.add(railMesh);
    }

    // -------------------------------------------------------------------------
    // 4. OVERHEAD ELECTRIC (OHE) MASTS AND WIRES
    // -------------------------------------------------------------------------
    const oheSpacing = 45;
    const oheStartX = -20;
    const oheEndX = 255;
    const oheMastCount = Math.floor((oheEndX - oheStartX) / oheSpacing) + 1;

    // Single mast geometry: vertical steel column and cantilever arms
    const mastColumnGeo = new THREE.BoxGeometry(0.24, 7.8, 0.24);
    mastColumnGeo.translate(0, 3.9, 0);
    const mastArmGeo = new THREE.BoxGeometry(0.14, 0.14, 6.4);
    mastArmGeo.translate(0, 7.2, 0);

    const mastGeo = new THREE.BufferGeometry();
    const posList = [];
    const normalList = [];
    const uvList = [];

    [mastColumnGeo, mastArmGeo].forEach((subGeo) => {
      const posAttr = subGeo.attributes.position;
      const normAttr = subGeo.attributes.normal;
      const uvAttr = subGeo.attributes.uv;
      for (let i = 0; i < posAttr.count; i++) {
        posList.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        normalList.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
        uvList.push(uvAttr.getX(i), uvAttr.getY(i));
      }
    });
    mastGeo.setAttribute('position', new THREE.Float32BufferAttribute(posList, 3));
    mastGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normalList, 3));
    mastGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvList, 2));

    const oheMaterial = new THREE.MeshStandardMaterial({
      color: '#606770',
      metalness: 0.5,
      roughness: 0.5,
    });
    const oheInstancedMesh = new THREE.InstancedMesh(mastGeo, oheMaterial, oheMastCount);
    oheInstancedMesh.castShadow = true;
    oheInstancedMesh.receiveShadow = true;

    for (let index = 0; index < oheMastCount; index++) {
      const ox = oheStartX + index * oheSpacing;
      dummyMatrix.position.set(ox, ballastY, (track1Z + track2Z) / 2);
      dummyMatrix.rotation.set(0, 0, 0);
      dummyMatrix.scale.set(1, 1, 1);
      dummyMatrix.updateMatrix();
      oheInstancedMesh.setMatrixAt(index, dummyMatrix.matrix);
    }
    oheInstancedMesh.instanceMatrix.needsUpdate = true;
    scene.add(oheInstancedMesh);

    // OHE Contact and Catenary wires
    const wireMat = new THREE.MeshBasicMaterial({ color: '#2B2F33' });
    const wireGeo = new THREE.BoxGeometry(ballastLength, 0.02, 0.02);

    const wireHeights = [5.5, 6.8];
    const wireTracks = [track1Z, track2Z];
    for (let trackIndex = 0; trackIndex < wireTracks.length; trackIndex++) {
      const wireZ = wireTracks[trackIndex];
      for (let heightIndex = 0; heightIndex < wireHeights.length; heightIndex++) {
        const wireMesh = new THREE.Mesh(wireGeo, wireMat);
        wireMesh.position.set(ballastCenterX, wireHeights[heightIndex], wireZ);
        scene.add(wireMesh);
      }
    }

    // -------------------------------------------------------------------------
    // 5. BOUNDARY WALL (z = 14.5)
    // -------------------------------------------------------------------------
    const wallZ = geometryConfig.BOUNDARY_WALL_Z !== undefined ? geometryConfig.BOUNDARY_WALL_Z : 14.5;
    const wallLength = 320;
    const wallHeight = 2.5;
    const boundaryWallGeo = new THREE.BoxGeometry(wallLength, wallHeight, 0.4);
    const boundaryWallMat = new THREE.MeshStandardMaterial({
      map: createRepeatTexture(textures.boundaryWall ? textures.boundaryWall() : null, wallLength / 2.4, wallHeight / 1.2),
      roughness: 0.95,
    });
    const boundaryWallMesh = new THREE.Mesh(boundaryWallGeo, boundaryWallMat);
    boundaryWallMesh.position.set(ballastCenterX, ballastY + wallHeight / 2, wallZ);
    boundaryWallMesh.receiveShadow = true;
    scene.add(boundaryWallMesh);

    // Coping slab on boundary wall
    const wallCopingGeo = new THREE.BoxGeometry(wallLength, 0.12, 0.52);
    const wallCopingMat = new THREE.MeshStandardMaterial({ color: '#A8A298', roughness: 0.8 });
    const wallCopingMesh = new THREE.Mesh(wallCopingGeo, wallCopingMat);
    wallCopingMesh.position.set(ballastCenterX, ballastY + wallHeight + 0.06, wallZ);
    wallCopingMesh.receiveShadow = true;
    scene.add(wallCopingMesh);

    // -------------------------------------------------------------------------
    // 6. BACKGROUND: COCONUT PALMS, HOUSES, LIGHTHOUSE, WESTERN GHATS
    // -------------------------------------------------------------------------
    const palmCount = 44;
    const palmPositions = [
      // Along boundary wall beyond tracks
      { x: -30, z: 18 }, { x: -16, z: 22 }, { x: -2, z: 19 }, { x: 14, z: 24 },
      { x: 28, z: 18 }, { x: 42, z: 22 }, { x: 56, z: 20 }, { x: 72, z: 25 },
      { x: 86, z: 19 }, { x: 102, z: 23 }, { x: 118, z: 18 }, { x: 134, z: 22 },
      { x: 148, z: 24 }, { x: 164, z: 19 }, { x: 178, z: 23 }, { x: 194, z: 18 },
      { x: 208, z: 22 }, { x: 224, z: 24 }, { x: 238, z: 19 }, { x: 252, z: 23 },
      { x: 266, z: 20 }, { x: 280, z: 22 },
      // Behind station building (z < -4.0)
      { x: -18, z: -14 }, { x: -6, z: -18 }, { x: 8, z: -15 }, { x: 22, z: -20 },
      { x: 36, z: -16 }, { x: 50, z: -18 }, { x: 64, z: -14 }, { x: 78, z: -19 },
      { x: 92, z: -15 }, { x: 106, z: -22 }, { x: 120, z: -16 }, { x: 134, z: -18 },
      { x: 148, z: -14 }, { x: 162, z: -20 }, { x: 176, z: -17 }, { x: 190, z: -21 },
      { x: 204, z: -15 }, { x: 218, z: -19 }, { x: 232, z: -16 }, { x: 246, z: -18 },
      { x: 260, z: -15 }, { x: 274, z: -20 },
    ];

    // Palm trunks (InstancedMesh: 1 draw call)
    const trunkHeight = 14;
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.38, trunkHeight, 8);
    trunkGeo.translate(0, trunkHeight / 2, 0);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: palette.trunk || '#7A5A3A',
      roughness: 0.85,
    });
    const palmTrunksMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
    palmTrunksMesh.castShadow = false;
    palmTrunksMesh.receiveShadow = false;

    // Palm fronds: 10 fronds per palm (440 instances in 1 InstancedMesh)
    const frondGeo = new THREE.ConeGeometry(0.65, 5.2, 5);
    frondGeo.translate(0, 2.6, 0);
    frondGeo.rotateX(Math.PI * 0.42);
    const frondMat = new THREE.MeshStandardMaterial({
      color: palette.leafDark || '#2A6430',
      roughness: 0.7,
    });
    const palmFrondsMesh = new THREE.InstancedMesh(frondGeo, frondMat, palmCount * 10);
    palmFrondsMesh.castShadow = false;

    let frondIndex = 0;
    for (let index = 0; index < palmCount; index++) {
      const palmSpec = palmPositions[index];
      const groundBaseY = (palmSpec.z > 0) ? ballastY : 0;
      dummyMatrix.position.set(palmSpec.x, groundBaseY, palmSpec.z);
      const tiltX = Math.sin(index * 1.7) * 0.08;
      const tiltZ = Math.cos(index * 2.3) * 0.08;
      dummyMatrix.rotation.set(tiltX, index * 0.5, tiltZ);
      dummyMatrix.scale.set(1, 1, 1);
      dummyMatrix.updateMatrix();
      palmTrunksMesh.setMatrixAt(index, dummyMatrix.matrix);

      // Two-tier arching fronds ring
      const crownTopY = groundBaseY + trunkHeight - 0.2;
      for (let leafIndex = 0; leafIndex < 10; leafIndex++) {
        const frondAngle = (leafIndex * Math.PI * 2) / 10 + (index * 0.4);
        const pitchAngle = (leafIndex % 2 === 0) ? 0.35 : 0.55;
        dummyMatrix.position.set(palmSpec.x, crownTopY, palmSpec.z);
        dummyMatrix.rotation.set(0, frondAngle, pitchAngle);
        dummyMatrix.scale.set(1, 1, 1);
        dummyMatrix.updateMatrix();
        palmFrondsMesh.setMatrixAt(frondIndex, dummyMatrix.matrix);
        frondIndex++;
      }
    }
    palmTrunksMesh.instanceMatrix.needsUpdate = true;
    palmFrondsMesh.instanceMatrix.needsUpdate = true;
    scene.add(palmTrunksMesh);
    scene.add(palmFrondsMesh);

    // Coastal Karnataka Mangalore-tiled houses
    const houseCoords = [
      { x: -10, z: 28 }, { x: 60, z: 32 }, { x: 160, z: 30 }, { x: 230, z: 28 },
      { x: 30, z: -25 }, { x: 140, z: -28 },
    ];
    const houseWallMat = new THREE.MeshStandardMaterial({ color: '#EFE7D8', roughness: 0.85 });
    const houseRoofMat = new THREE.MeshStandardMaterial({
      map: createRepeatTexture(textures.roofTiles ? textures.roofTiles() : null, 4, 3),
      roughness: 0.85,
    });
    for (let index = 0; index < houseCoords.length; index++) {
      const hSpec = houseCoords[index];
      const hGroup = new THREE.Group();
      hGroup.position.set(hSpec.x, ballastY, hSpec.z);

      const hBody = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 6), houseWallMat);
      hBody.position.y = 2.25;
      hBody.castShadow = false;
      hGroup.add(hBody);

      const hRoof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 3.2, 4), houseRoofMat);
      hRoof.position.y = 5.8;
      hRoof.rotation.y = Math.PI / 4;
      hRoof.castShadow = false;
      hGroup.add(hRoof);

      scene.add(hGroup);
    }

    // Light House Hill (Mangaluru historic lighthouse)
    const hillMoundGeo = new THREE.SphereGeometry(38, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
    hillMoundGeo.scale(1.4, 0.45, 1.0);
    const hillMat = new THREE.MeshStandardMaterial({ color: '#3A6335', roughness: 0.95 });
    const hillMesh = new THREE.Mesh(hillMoundGeo, hillMat);
    hillMesh.position.set(120, ballastY - 2, 60);
    hillMesh.castShadow = false;
    scene.add(hillMesh);

    // Lighthouse tower
    const lhTowerGeo = new THREE.CylinderGeometry(2.4, 3.4, 16, 8);
    const lhTowerMat = new THREE.MeshStandardMaterial({ color: '#F5F5F5', roughness: 0.7 });
    const lhTowerMesh = new THREE.Mesh(lhTowerGeo, lhTowerMat);
    lhTowerMesh.position.set(120, ballastY + 22, 60);
    lhTowerMesh.castShadow = false;
    scene.add(lhTowerMesh);

    // Lighthouse lantern room (red dome)
    const lhLanternGeo = new THREE.CylinderGeometry(2.0, 2.0, 3.0, 8);
    const lhLanternMat = new THREE.MeshStandardMaterial({ color: '#C62828', roughness: 0.3 });
    const lhLanternMesh = new THREE.Mesh(lhLanternGeo, lhLanternMat);
    lhLanternMesh.position.set(120, ballastY + 31.5, 60);
    lhLanternMesh.castShadow = false;
    scene.add(lhLanternMesh);

    // Western Ghats silhouettes
    const ghatsGeo = new THREE.ConeGeometry(55, 36, 5);
    ghatsGeo.scale(2.2, 1.0, 0.6);
    const ghatsMat = new THREE.MeshBasicMaterial({ color: '#4A6B82', depthWrite: false });
    const ghatsPositions = [-30, 40, 110, 180, 250];
    for (let index = 0; index < ghatsPositions.length; index++) {
      const gMesh = new THREE.Mesh(ghatsGeo, ghatsMat);
      gMesh.position.set(ghatsPositions[index], 0, -130);
      gMesh.castShadow = false;
      scene.add(gMesh);
    }

    // -------------------------------------------------------------------------
    // 7. STATION BUILDING ALONG z = -4.0
    // -------------------------------------------------------------------------
    const buildingWallZ = geometryConfig.WALL_Z !== undefined ? geometryConfig.WALL_Z : -4.0;
    const buildingHeight = geometryConfig.BUILDING_HEIGHT !== undefined ? geometryConfig.BUILDING_HEIGHT : 6.0;
    const buildingLength = 265;
    const buildingCenterX = 117;

    // Main wall (cream plaster)
    const mainWallGeo = new THREE.BoxGeometry(buildingLength, buildingHeight - 1.2, 0.4);
    const mainWallMat = new THREE.MeshStandardMaterial({
      map: createRepeatTexture(textures.wallPlaster ? textures.wallPlaster() : null, buildingLength / 4.0, (buildingHeight - 1.2) / 2.0),
      roughness: 0.85,
    });
    const mainWallMesh = new THREE.Mesh(mainWallGeo, mainWallMat);
    mainWallMesh.position.set(buildingCenterX, 1.2 + (buildingHeight - 1.2) / 2, buildingWallZ - 0.2);
    mainWallMesh.castShadow = true;
    mainWallMesh.receiveShadow = true;
    scene.add(mainWallMesh);

    // Maroon dado band along bottom 1.2 m
    const dadoGeo = new THREE.BoxGeometry(buildingLength, 1.2, 0.44);
    const dadoMat = new THREE.MeshStandardMaterial({
      color: palette.dado || '#8E2F22',
      roughness: 0.8,
    });
    const dadoMesh = new THREE.Mesh(dadoGeo, dadoMat);
    dadoMesh.position.set(buildingCenterX, 0.6, buildingWallZ - 0.22);
    dadoMesh.castShadow = true;
    dadoMesh.receiveShadow = true;
    scene.add(dadoMesh);

    // Sloping Mangalore-tile roof over station building
    const roofSlopeWidth = 4.8;
    const roofGeo = new THREE.BoxGeometry(buildingLength + 4, 0.22, roofSlopeWidth);
    roofGeo.rotateX(0.42);
    const roofMat = new THREE.MeshStandardMaterial({
      map: createRepeatTexture(textures.roofTiles ? textures.roofTiles() : null, (buildingLength + 4) / 2.0, roofSlopeWidth / 1.0),
      roughness: 0.85,
    });
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.set(buildingCenterX, buildingHeight + 1.2, buildingWallZ - 1.6);
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    scene.add(roofMesh);

    // Build reserved X intervals from wall-mounted decor and stall/bench solids
    const reservedIntervals = buildReservedIntervals(level);

    // Station doors with heritage signplates (shifted if intersecting decor, flush <= 0.06m protrusion)
    const doorSpecs = [
      { x: 10, label: 'BOOKING OFFICE' },
      { x: 50, label: 'WAITING ROOM' },
      { x: 90, label: 'STATION MASTER' },
      { x: 170, label: 'CLOAK ROOM' },
    ];
    // Door depth 0.06m; placed at buildingWallZ + 0.025 -> front face at buildingWallZ + 0.055m (5.5cm protrusion <= 0.06m)
    const doorGeo = new THREE.BoxGeometry(1.6, 2.8, 0.06);
    const doorMat = new THREE.MeshStandardMaterial({
      color: palette.doorGreen || '#2F5D3A',
      roughness: 0.6,
    });
    const doorHalfWidth = 0.8;

    for (let index = 0; index < doorSpecs.length; index++) {
      const dSpec = doorSpecs[index];
      const clearDoorX = findClearPosition(dSpec.x, doorHalfWidth, reservedIntervals, 0, buildingLength);
      // Reserve interval for placed door so windows also avoid it
      reservedIntervals.push({
        minX: clearDoorX - doorHalfWidth,
        maxX: clearDoorX + doorHalfWidth,
      });

      const doorMesh = new THREE.Mesh(doorGeo, doorMat);
      doorMesh.position.set(clearDoorX, 1.4, buildingWallZ + 0.025);
      doorMesh.castShadow = true;
      doorMesh.receiveShadow = true;
      scene.add(doorMesh);

      const signTexture = textures.textBoard
        ? textures.textBoard([dSpec.label], { width: 512, height: 128, bg: '#FFFFFF', fg: '#151515' })
        : null;
      const signPlate = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 0.35),
        new THREE.MeshStandardMaterial({ map: signTexture, roughness: 0.4 })
      );
      signPlate.position.set(clearDoorX, 3.0, buildingWallZ + 0.058);
      scene.add(signPlate);
    }

    // Heritage station windows (cream frame, small sill, dark green louvred infill, instanced)
    const windowSpacing = 6.0;
    const windowStartX = 0;
    const windowEndX = 236;
    const windowCount = Math.floor((windowEndX - windowStartX) / windowSpacing);
    const windowHalfWidth = 0.7;

    const winFrameGeo = buildWindowFrameGeometry();
    const winInfillGeo = buildWindowInfillGeometry();

    const winFrameMat = new THREE.MeshStandardMaterial({
      color: palette.cream || '#F3E3C3',
      roughness: 0.6,
    });
    const winInfillMat = new THREE.MeshStandardMaterial({
      color: palette.doorGreen || '#1D4528',
      roughness: 0.5,
    });

    const winFrameInstancedMesh = new THREE.InstancedMesh(winFrameGeo, winFrameMat, windowCount);
    const winInfillInstancedMesh = new THREE.InstancedMesh(winInfillGeo, winInfillMat, windowCount);
    winFrameInstancedMesh.castShadow = true;
    winFrameInstancedMesh.receiveShadow = true;
    winInfillInstancedMesh.receiveShadow = true;

    for (let index = 0; index < windowCount; index++) {
      const wx = windowStartX + index * windowSpacing;
      // Skip window if it intersects any reserved interval (decor, solids, or placed doors)
      if (isRangeIntersecting(wx - windowHalfWidth, wx + windowHalfWidth, reservedIntervals)) {
        dummyMatrix.position.set(wx, -100, 0);
        dummyMatrix.scale.set(0, 0, 0);
      } else {
        dummyMatrix.position.set(wx, 3.2, buildingWallZ + 0.02);
        dummyMatrix.rotation.set(0, 0, 0);
        dummyMatrix.scale.set(1, 1, 1);
      }
      dummyMatrix.updateMatrix();
      winFrameInstancedMesh.setMatrixAt(index, dummyMatrix.matrix);
      winInfillInstancedMesh.setMatrixAt(index, dummyMatrix.matrix);
    }
    winFrameInstancedMesh.instanceMatrix.needsUpdate = true;
    winInfillInstancedMesh.instanceMatrix.needsUpdate = true;
    scene.add(winFrameInstancedMesh);
    scene.add(winInfillInstancedMesh);

    // -------------------------------------------------------------------------
    // 8. CANOPIES OVER CANOPY SECTIONS
    // -------------------------------------------------------------------------
    const canopySections = (level.sections || []).filter((s) => s.canopy);
    const canopyY = geometryConfig.CANOPY_Y !== undefined ? geometryConfig.CANOPY_Y : 8.0;
    const canopyZMin = buildingWallZ;
    const canopyZMax = 4.2;
    const canopyDepth = canopyZMax - canopyZMin;
    const canopyCenterZ = (canopyZMin + canopyZMax) / 2;

    for (let index = 0; index < canopySections.length; index++) {
      const section = canopySections[index];
      const secWidth = section.x1 - section.x0;
      const secCenterX = (section.x0 + section.x1) / 2;

      // Canopy underside (ceiling)
      const ceilGeo = new THREE.PlaneGeometry(secWidth, canopyDepth);
      ceilGeo.rotateX(Math.PI / 2);
      const ceilMat = new THREE.MeshStandardMaterial({
        map: createRepeatTexture(textures.canopyUnderside ? textures.canopyUnderside() : null, secWidth / 2.0, canopyDepth / 2.0),
        roughness: 0.9,
      });
      const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
      ceilMesh.position.set(secCenterX, canopyY, canopyCenterZ);
      ceilMesh.receiveShadow = true;
      scene.add(ceilMesh);

      // Canopy roof top (Mangalore tiles)
      const topRoofGeo = new THREE.PlaneGeometry(secWidth, canopyDepth);
      topRoofGeo.rotateX(-Math.PI / 2);
      const topRoofMat = new THREE.MeshStandardMaterial({
        map: createRepeatTexture(textures.roofTiles ? textures.roofTiles() : null, secWidth / 2.0, canopyDepth / 1.0),
        roughness: 0.85,
      });
      const topRoofMesh = new THREE.Mesh(topRoofGeo, topRoofMat);
      topRoofMesh.position.set(secCenterX, canopyY + 0.15, canopyCenterZ);
      topRoofMesh.castShadow = true;
      scene.add(topRoofMesh);

      // Scalloped fascia board along outer platform edge
      const fasciaGeo = new THREE.BoxGeometry(secWidth, 0.45, 0.08);
      const fasciaMat = new THREE.MeshStandardMaterial({
        color: palette.cream || '#F3E3C3',
        roughness: 0.6,
      });
      const fasciaMesh = new THREE.Mesh(fasciaGeo, fasciaMat);
      fasciaMesh.position.set(secCenterX, canopyY - 0.22, canopyZMax);
      fasciaMesh.castShadow = true;
      scene.add(fasciaMesh);
    }

    // -------------------------------------------------------------------------
    // 9. LEVEL SOLIDS RENDERING (PLATFORMS, PITS, CHIMNEYS, BENCHES, STALLS, ETC.)
    // -------------------------------------------------------------------------
    const solids = level.solids || [];
    const npcAnimators = [];
    const smokePuffs = [];
    let waterTexClone = null;

    const copingMat = new THREE.MeshStandardMaterial({
      color: palette.coping || '#D8D3C8',
      roughness: 0.8,
    });
    const pillarMat = new THREE.MeshStandardMaterial({
      color: palette.pillarGreen || '#2F4F3A',
      roughness: 0.45,
      metalness: 0.3,
    });
    const steelBenchMat = new THREE.MeshStandardMaterial({
      color: '#B0B5BA',
      metalness: 0.65,
      roughness: 0.3,
    });

    for (let index = 0; index < solids.length; index++) {
      const solid = solids[index];

      if (solid.kind === 'barrier') {
        continue;
      }

      if (solid.kind === 'platform') {
        const pw = solid.w;
        const ph = solid.h;
        const px = solid.x;
        const py = solid.y;

        // 1. Stone top (z: -4.0 to 2.6, width = 6.6m, center = -0.7)
        const stoneWidthZ = 6.6;
        const stoneCenterZ = -0.7;
        const stoneMatInstance = new THREE.MeshStandardMaterial({
          map: createRepeatTexture(textures.platformFloor ? textures.platformFloor() : null, pw / 2.4, stoneWidthZ / 2.4),
          roughness: 0.85,
        });
        const stoneMesh = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, stoneWidthZ), stoneMatInstance);
        stoneMesh.position.set(px, py + ph / 2, stoneCenterZ);
        stoneMesh.receiveShadow = true;
        scene.add(stoneMesh);

        // 2. Tactile yellow strip (z: 2.6 to 3.0, width = 0.4m, center = 2.8)
        const tactileWidthZ = 0.4;
        const tactileCenterZ = 2.8;
        const tactileMatInstance = new THREE.MeshStandardMaterial({
          map: createRepeatTexture(textures.tactileStrip ? textures.tactileStrip() : null, pw / 0.4, 1.0),
          roughness: 0.7,
        });
        const tactileMesh = new THREE.Mesh(new THREE.BoxGeometry(pw, ph + 0.01, tactileWidthZ), tactileMatInstance);
        tactileMesh.position.set(px, py + (ph + 0.01) / 2, tactileCenterZ);
        tactileMesh.receiveShadow = true;
        scene.add(tactileMesh);

        // 3. Coping edge (z: 3.0 to 4.0, width = 1.0m, center = 3.5)
        const copingWidthZ = 1.0;
        const copingCenterZ = 3.5;
        const copingMesh = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, copingWidthZ), copingMat);
        copingMesh.position.set(px, py + ph / 2, copingCenterZ);
        copingMesh.receiveShadow = true;
        scene.add(copingMesh);

        // 4. Platform concrete fascia facing Track 1 (z = 4.0)
        const fasciaGeo = new THREE.BoxGeometry(pw, ph, 0.08);
        const fasciaMesh = new THREE.Mesh(fasciaGeo, new THREE.MeshStandardMaterial({ color: '#7A756D', roughness: 0.9 }));
        fasciaMesh.position.set(px, py + ph / 2, 4.0);
        fasciaMesh.receiveShadow = true;
        scene.add(fasciaMesh);
      } else if (solid.kind === 'laterite') {
        const colMat = new THREE.MeshStandardMaterial({
          map: createRepeatTexture(textures.laterite ? textures.laterite() : null, 1.0, solid.h / 1.0),
          roughness: 0.95,
        });
        const colMesh = new THREE.Mesh(new THREE.BoxGeometry(solid.w, solid.h, solid.d), colMat);
        colMesh.position.set(solid.x, solid.y + solid.h / 2, solid.z);
        colMesh.castShadow = true;
        colMesh.receiveShadow = true;
        scene.add(colMesh);
      } else if (solid.kind === 'chimney') {
        const chimMat = new THREE.MeshStandardMaterial({
          map: createRepeatTexture(textures.tileBlock ? textures.tileBlock() : null, 1.8, solid.h),
          roughness: 0.85,
        });
        const chimMesh = new THREE.Mesh(new THREE.BoxGeometry(solid.w, solid.h, solid.d), chimMat);
        chimMesh.position.set(solid.x, solid.y + solid.h / 2, solid.z);
        chimMesh.castShadow = true;
        chimMesh.receiveShadow = true;
        scene.add(chimMesh);

        const sootRim = new THREE.Mesh(
          new THREE.BoxGeometry(solid.w + 0.06, 0.16, solid.d + 0.06),
          new THREE.MeshStandardMaterial({ color: '#1B1B1B', roughness: 0.9 })
        );
        sootRim.position.set(solid.x, solid.y + solid.h - 0.08, solid.z);
        scene.add(sootRim);

        const puffMat = new THREE.MeshStandardMaterial({
          color: '#E0E0E0',
          transparent: true,
          opacity: 0.45,
          roughness: 1.0,
        });
        for (let puffIndex = 0; puffIndex < 3; puffIndex++) {
          const puffMesh = new THREE.Mesh(new THREE.SphereGeometry(0.35 + puffIndex * 0.1, 7, 6), puffMat);
          puffMesh.position.set(solid.x, solid.h + 0.4 + puffIndex * 0.7, solid.z);
          puffMesh.userData.baseY = solid.h + 0.2;
          puffMesh.userData.offset = puffIndex * 0.8;
          scene.add(puffMesh);
          smokePuffs.push(puffMesh);
        }
      } else if (solid.kind === 'pillar') {
        const pillarGroup = new THREE.Group();
        pillarGroup.position.set(solid.x, solid.y, solid.z);

        const pBase = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6), pillarMat);
        pBase.position.y = 0.2;
        pBase.castShadow = true;
        pBase.receiveShadow = true;
        pillarGroup.add(pBase);

        const pColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7.2, 12), pillarMat);
        pColumn.position.y = 4.0;
        pColumn.castShadow = true;
        pColumn.receiveShadow = true;
        pillarGroup.add(pColumn);

        const pCapital = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.4, 0.58), pillarMat);
        pCapital.position.y = 7.8;
        pCapital.castShadow = true;
        pillarGroup.add(pCapital);

        scene.add(pillarGroup);
      } else if (solid.kind === 'bench') {
        const benchGroup = new THREE.Group();
        benchGroup.position.set(solid.x, solid.y, solid.z);

        const legMat = steelBenchMat;
        [-0.9, 0.9].forEach((lx) => {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.48, 8), legMat);
          leg.position.set(lx, 0.24, 0);
          leg.castShadow = true;
          benchGroup.add(leg);
        });

        const seat = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 0.6), steelBenchMat);
        seat.position.set(0, 0.45, 0);
        seat.castShadow = true;
        seat.receiveShadow = true;
        benchGroup.add(seat);

        const back = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.36, 0.05), steelBenchMat);
        back.position.set(0, 0.72, -0.28);
        back.castShadow = true;
        benchGroup.add(back);

        scene.add(benchGroup);
      } else if (solid.kind === 'stall') {
        const stallGroup = new THREE.Group();
        stallGroup.position.set(solid.x, solid.y, solid.z);

        const counter = new THREE.Mesh(
          new THREE.BoxGeometry(solid.w, 1.1, solid.d),
          new THREE.MeshStandardMaterial({ color: '#5D4037', roughness: 0.7 })
        );
        counter.position.y = 0.55;
        counter.castShadow = true;
        counter.receiveShadow = true;
        stallGroup.add(counter);

        const awning = new THREE.Mesh(
          new THREE.BoxGeometry(solid.w + 0.3, 0.08, solid.d + 0.4),
          new THREE.MeshStandardMaterial({ color: '#D7261E', roughness: 0.5 })
        );
        awning.position.set(0, 2.5, 0.1);
        awning.rotation.x = 0.2;
        awning.castShadow = true;
        stallGroup.add(awning);

        const stallProps = solid.props || {};
        const stallTitleTex = textures.textBoard
          ? textures.textBoard([stallProps.name || 'STALL'], { width: 512, height: 128, bg: '#8E2F22', fg: '#FFD100' })
          : null;
        const nameBoard = new THREE.Mesh(
          new THREE.PlaneGeometry(solid.w * 0.9, 0.45),
          new THREE.MeshStandardMaterial({ map: stallTitleTex, roughness: 0.4 })
        );
        nameBoard.position.set(0, 2.1, solid.d / 2 + 0.02);
        stallGroup.add(nameBoard);

        if (stallProps.menu && textures.textBoard) {
          const menuTex = textures.textBoard(stallProps.menu, { width: 512, height: 384, bg: '#151515', fg: '#FFFFFF' });
          const menuBoard = new THREE.Mesh(
            new THREE.PlaneGeometry(1.0, 0.75),
            new THREE.MeshStandardMaterial({ map: menuTex, roughness: 0.4 })
          );
          menuBoard.position.set(solid.w / 2 + 0.02, 1.4, 0);
          menuBoard.rotation.y = Math.PI / 2;
          stallGroup.add(menuBoard);
        }

        scene.add(stallGroup);
      } else if (solid.kind === 'npc') {
        const npcGroup = new THREE.Group();
        npcGroup.position.set(solid.x, solid.y, solid.z);
        const variant = (solid.props && solid.props.variant) || 'porter';
        const skinMat = new THREE.MeshStandardMaterial({ color: '#C68642', roughness: 0.7 });

        if (variant === 'porter') {
          const dhoti = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.7, 8), new THREE.MeshStandardMaterial({ color: '#ECEFF1' }));
          dhoti.position.y = 0.35;
          dhoti.castShadow = true;
          npcGroup.add(dhoti);

          const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.26), new THREE.MeshStandardMaterial({ color: '#C62828' }));
          shirt.position.y = 0.96;
          shirt.castShadow = true;
          npcGroup.add(shirt);

          const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), skinMat);
          head.position.y = 1.35;
          head.castShadow = true;
          npcGroup.add(head);

          const armBand = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8), new THREE.MeshStandardMaterial({ color: '#D4AF37', metalness: 0.8 }));
          armBand.position.set(0.24, 1.05, 0);
          npcGroup.add(armBand);

          const suitcase = new THREE.Mesh(
            new THREE.BoxGeometry(0.68, 0.28, 0.46),
            new THREE.MeshStandardMaterial({ color: '#4E342E', roughness: 0.6 })
          );
          suitcase.position.y = 1.62;
          suitcase.castShadow = true;
          npcGroup.add(suitcase);

          npcAnimators.push((time) => {
            npcGroup.position.y = Math.sin(time * 2.0) * 0.015;
          });
        } else if (variant === 'saree') {
          const sareeMat = new THREE.MeshStandardMaterial({ color: '#00796B', roughness: 0.6 });
          const sareeDrape = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 1.25, 10), sareeMat);
          sareeDrape.position.y = 0.62;
          sareeDrape.castShadow = true;
          npcGroup.add(sareeDrape);

          const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), skinMat);
          head.position.y = 1.38;
          head.castShadow = true;
          npcGroup.add(head);

          const jasmine = new THREE.Mesh(
            new THREE.TorusGeometry(0.08, 0.03, 6, 12),
            new THREE.MeshStandardMaterial({ color: '#FFFDE7', roughness: 0.4 })
          );
          jasmine.position.set(0, 1.42, -0.11);
          npcGroup.add(jasmine);

          npcAnimators.push((time) => {
            npcGroup.rotation.y = Math.sin(time * 0.8) * 0.05;
          });
        } else if (variant === 'mundu') {
          const munduDrape = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.85, 8), new THREE.MeshStandardMaterial({ color: '#F5F5F5' }));
          munduDrape.position.y = 0.42;
          munduDrape.castShadow = true;
          npcGroup.add(munduDrape);

          const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.24), new THREE.MeshStandardMaterial({ color: '#FAFAFA' }));
          shirt.position.y = 1.0;
          shirt.castShadow = true;
          npcGroup.add(shirt);

          const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), skinMat);
          head.position.y = 1.36;
          head.castShadow = true;
          npcGroup.add(head);

          const newsPaper = new THREE.Mesh(
            new THREE.BoxGeometry(0.38, 0.28, 0.02),
            new THREE.MeshStandardMaterial({ color: '#ECEFF1', roughness: 0.9 })
          );
          newsPaper.position.set(0, 1.05, 0.22);
          newsPaper.rotation.x = -0.35;
          npcGroup.add(newsPaper);

          npcAnimators.push((time) => {
            newsPaper.rotation.x = -0.35 + Math.sin(time * 1.5) * 0.03;
          });
        } else if (variant === 'guard') {
          const uniformMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.7 });
          const pants = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.85, 8), uniformMat);
          pants.position.y = 0.42;
          pants.castShadow = true;
          npcGroup.add(pants);

          const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.26), uniformMat);
          shirt.position.y = 1.02;
          shirt.castShadow = true;
          npcGroup.add(shirt);

          const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), skinMat);
          head.position.y = 1.40;
          head.castShadow = true;
          npcGroup.add(head);

          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10), uniformMat);
          cap.position.y = 1.50;
          npcGroup.add(cap);

          const flagArm = new THREE.Group();
          flagArm.position.set(0.24, 1.15, 0);

          const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.36, 6), uniformMat);
          armMesh.position.set(0.12, 0, 0);
          armMesh.rotation.z = -Math.PI / 3;
          flagArm.add(armMesh);

          const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.65, 6), new THREE.MeshStandardMaterial({ color: '#4E342E' }));
          baton.position.set(0.26, 0.18, 0);
          flagArm.add(baton);

          const greenCloth = new THREE.Mesh(
            new THREE.PlaneGeometry(0.42, 0.30),
            new THREE.MeshStandardMaterial({ color: palette.flagGreen || '#1E9E3A', side: THREE.DoubleSide })
          );
          greenCloth.position.set(0.48, 0.32, 0);
          flagArm.add(greenCloth);
          npcGroup.add(flagArm);

          npcAnimators.push((time) => {
            flagArm.rotation.z = Math.sin(time * 3.5) * 0.35;
          });
        }

        scene.add(npcGroup);
      }
    }

    // Monsoon drain pit animated waters
    const pits = level.pits || [];
    const pitWaterY = geometryConfig.PIT_WATER_Y !== undefined ? geometryConfig.PIT_WATER_Y : -3.0;
    const baseWaterTex = textures.water ? textures.water() : null;
    waterTexClone = baseWaterTex ? baseWaterTex.clone() : null;
    if (waterTexClone) {
      waterTexClone.wrapS = THREE.RepeatWrapping;
      waterTexClone.wrapT = THREE.RepeatWrapping;
      waterTexClone.repeat.set(2, 2);
    }
    const waterMat = new THREE.MeshStandardMaterial({
      map: waterTexClone,
      color: palette.water || '#2E5E5A',
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85,
    });

    for (let index = 0; index < pits.length; index++) {
      const pitSpec = pits[index];
      const pitWidth = pitSpec.x1 - pitSpec.x0;
      const pitCenterX = (pitSpec.x0 + pitSpec.x1) / 2;

      const waterGeo = new THREE.PlaneGeometry(pitWidth, 8.0);
      waterGeo.rotateX(-Math.PI / 2);
      const waterMesh = new THREE.Mesh(waterGeo, waterMat);
      waterMesh.position.set(pitCenterX, pitWaterY, 0);
      scene.add(waterMesh);

      const wallThick = 0.4;
      const pWallMat = new THREE.MeshStandardMaterial({
        map: createRepeatTexture(textures.laterite ? textures.laterite() : null, 1.0, 3.0),
        roughness: 0.95,
      });
      [-1, 1].forEach((side) => {
        const borderX = (side === -1) ? pitSpec.x0 - wallThick / 2 : pitSpec.x1 + wallThick / 2;
        const pWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, 3.0, 8.0), pWallMat);
        pWall.position.set(borderX, -1.5, 0);
        pWall.receiveShadow = true;
        scene.add(pWall);
      });
    }

    // -------------------------------------------------------------------------
    // 10. DECOR RENDERING (SIGNAGE, POSTERS, CLOCKS, LED BOARD, ETC.)
    // -------------------------------------------------------------------------
    const decorList = level.decor || [];
    const clockHands = [];

    for (let index = 0; index < decorList.length; index++) {
      const decorItem = decorList[index];
      const type = decorItem.type;
      const props = decorItem.props || {};

      if (type === 'overheadBoard') {
        const lines = props.lines || ['PLATFORM 1', '12620 MATSYAGANDHA EXP'];
        const boardTex = textures.textBoard ? textures.textBoard(lines, { width: 1024, height: 256, bg: '#1F4E9C', fg: '#FFFFFF' }) : null;
        const boardMesh = new THREE.Mesh(
          new THREE.BoxGeometry(4.2, 1.1, 0.12),
          new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.5 })
        );
        boardMesh.position.set(decorItem.x, decorItem.y, decorItem.z);
        boardMesh.rotation.y = decorItem.rotY || 0;
        boardMesh.castShadow = true;
        scene.add(boardMesh);
      } else if (type === 'ledBoard') {
        const textStr = props.text || '12620 MATSYAGANDHA EXPRESS';
        const ledTex = textures.ledBoard ? textures.ledBoard(textStr) : null;
        const ledMesh = new THREE.Mesh(
          new THREE.BoxGeometry(6.4, 0.9, 0.14),
          new THREE.MeshStandardMaterial({ map: ledTex, roughness: 0.3 })
        );
        ledMesh.position.set(decorItem.x, decorItem.y, decorItem.z);
        ledMesh.rotation.y = decorItem.rotY || 0;
        ledMesh.castShadow = true;
        scene.add(ledMesh);
      } else if (type === 'wallBoard' || type === 'farBoard') {
        const stationTex = textures.stationNameBoard ? textures.stationNameBoard() : null;
        const boardMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(3.6, 1.35),
          new THREE.MeshStandardMaterial({ map: stationTex, roughness: 0.4 })
        );
        boardMesh.position.set(decorItem.x, decorItem.y, decorItem.z);
        boardMesh.rotation.y = decorItem.rotY || 0;
        scene.add(boardMesh);
      } else if (type === 'poster') {
        const posterGroup = new THREE.Group();
        posterGroup.position.set(decorItem.x, decorItem.y, decorItem.z);
        posterGroup.rotation.y = decorItem.rotY || 0;

        // Aluminium poster frame case
        const frameBox = new THREE.Mesh(
          new THREE.BoxGeometry(1.28, 1.88, 0.04),
          new THREE.MeshStandardMaterial({ color: '#D0D7DE', metalness: 0.6, roughness: 0.3 })
        );
        frameBox.position.z = -0.01;
        posterGroup.add(frameBox);

        // Poster graphic artwork
        const posterTex = textures.poster ? textures.poster(props.key) : null;
        const posterMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.2, 1.8),
          new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.4, side: THREE.DoubleSide })
        );
        posterMesh.position.z = 0.015;
        posterGroup.add(posterMesh);

        scene.add(posterGroup);
      } else if (type === 'clock') {
        const clockGroup = new THREE.Group();
        clockGroup.position.set(decorItem.x, decorItem.y, decorItem.z);

        const clockDial = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.55, 0.12, 24),
          new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.4 })
        );
        clockDial.rotation.x = Math.PI / 2;
        clockGroup.add(clockDial);

        const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.02), new THREE.MeshStandardMaterial({ color: '#151515' }));
        hourHand.position.set(0, 0.14, 0.07);
        clockGroup.add(hourHand);

        const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.44, 0.02), new THREE.MeshStandardMaterial({ color: '#151515' }));
        minHand.position.set(0, 0.20, 0.08);
        clockGroup.add(minHand);

        clockHands.push({ hourHand, minHand });
        scene.add(clockGroup);
      } else if (type === 'sign') {
        const lines = props.lines || ['CAUTION'];
        const style = props.style || 'caution';
        let bgCol = '#FFFFFF';
        let fgCol = '#D7261E';
        if (style === 'run') {
          bgCol = '#FFD100';
          fgCol = '#151515';
        } else if (style === 'info') {
          bgCol = '#2F5D3A';
          fgCol = '#FFFFFF';
        }
        const signTex = textures.textBoard ? textures.textBoard(lines, { width: 512, height: 256, bg: bgCol, fg: fgCol }) : null;
        const signMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(1.6, 0.8),
          new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4 })
        );
        signMesh.position.set(decorItem.x, decorItem.y, decorItem.z);
        signMesh.rotation.y = decorItem.rotY || 0;
        scene.add(signMesh);
      } else if (type === 'signal') {
        const signalGroup = new THREE.Group();
        signalGroup.position.set(decorItem.x, decorItem.y, decorItem.z);

        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.8, 8), new THREE.MeshStandardMaterial({ color: '#333333' }));
        mast.position.y = 2.4;
        signalGroup.add(mast);

        const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.2, 0.3), new THREE.MeshStandardMaterial({ color: '#151515' }));
        headBox.position.set(0, 4.8, 0);
        signalGroup.add(headBox);

        const greenLamp = new THREE.Mesh(
          new THREE.CircleGeometry(0.12, 12),
          new THREE.MeshBasicMaterial({ color: '#00E676' })
        );
        greenLamp.position.set(0, 4.5, 0.16);
        signalGroup.add(greenLamp);

        scene.add(signalGroup);
      } else if (type === 'dustbin') {
        const binGroup = new THREE.Group();
        binGroup.position.set(decorItem.x, decorItem.y, decorItem.z);

        const cylinder = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.22, 0.75, 12),
          new THREE.MeshStandardMaterial({ color: '#2E7D32', roughness: 0.5 })
        );
        cylinder.position.y = 0.52;
        cylinder.castShadow = true;
        binGroup.add(cylinder);

        scene.add(binGroup);
      } else if (type === 'waterTap') {
        const tapGroup = new THREE.Group();
        tapGroup.position.set(decorItem.x, decorItem.y, decorItem.z);

        const basin = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.8, 0.6),
          new THREE.MeshStandardMaterial({ color: '#E0E0E0', roughness: 0.4 })
        );
        basin.position.y = 0.4;
        basin.castShadow = true;
        tapGroup.add(basin);

        const tapPipe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6),
          new THREE.MeshStandardMaterial({ color: '#D4AF37', metalness: 0.8 })
        );
        tapPipe.position.set(0, 0.95, -0.15);
        tapGroup.add(tapPipe);

        scene.add(tapGroup);
      }
    }

    // -------------------------------------------------------------------------
    // 11. STANDING TRAIN: 12620 MATSYAGANDHA EXPRESS (TRACK 1)
    // -------------------------------------------------------------------------
    const levelTrain = level.train || { rearX: 222, z: 6.0, cars: 8, doorX: 225.5 };
    const standingTrain = new THREE.Group();
    standingTrain.name = 'standingTrain';
    standingTrain.position.set(levelTrain.rearX, railTopY, levelTrain.z);

    const carLength = trainConfig.CAR_LENGTH || 22;
    const locoLength = trainConfig.LOCO_LENGTH || 19;
    const coachWidth = 3.24;
    const coachHeight = 3.88;
    const carCount = levelTrain.cars || 8;

    const destBoardTex = textures.canvasTexture
      ? textures.canvasTexture(1024, 128, (context, width, height) => {
          context.fillStyle = palette.irYellow || '#FFD100';
          context.fillRect(0, 0, width, height);
          context.strokeStyle = '#151515';
          context.lineWidth = 8;
          context.strokeRect(4, 4, width - 8, height - 8);
          context.fillStyle = '#151515';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.font = 'bold 36px "Baloo 2", sans-serif';
          context.fillText('12620 MATSYAGANDHA EXPRESS', width / 2, 38);
          context.font = 'bold 28px sans-serif';
          context.fillText('MANGALURU CENTRAL - LOKMANYA TILAK (T)', width / 2, 88);
        }, { cacheKey: 'train_matsyagandha_board' })
      : null;

    const coachBodyMat = new THREE.MeshStandardMaterial({
      color: palette.coachBlue || '#1F4E9C',
      roughness: 0.45,
    });
    const coachBandMat = new THREE.MeshStandardMaterial({
      color: palette.coachBand || '#F4F1E8',
      roughness: 0.5,
    });
    const coachRoofMat = new THREE.MeshStandardMaterial({
      color: '#8E9499',
      roughness: 0.6,
    });
    const destBoardMat = new THREE.MeshStandardMaterial({
      map: destBoardTex,
      roughness: 0.4,
    });
    const winPaneGeo = new THREE.PlaneGeometry(0.75, 0.45);
    const winPaneMat = new THREE.MeshStandardMaterial({
      color: '#101820',
      roughness: 0.2,
      metalness: 0.8,
    });

    const coachCodes = ['SLR', 'S1', 'S2', 'S3', 'B1', 'B2', 'A1', 'GEN'];

    for (let carIndex = 0; carIndex < carCount; carIndex++) {
      const carGroup = new THREE.Group();
      const carStartX = carIndex * carLength;
      const carCenterX = carStartX + carLength / 2;

      // Coach body box
      const bodyMesh = new THREE.Mesh(
        new THREE.BoxGeometry(carLength - 0.4, coachHeight - 0.7, coachWidth),
        coachBodyMat
      );
      bodyMesh.position.set(carCenterX, (coachHeight - 0.7) / 2 + 0.35, 0);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      carGroup.add(bodyMesh);

      // Cream window band along platform side (local z = -coachWidth / 2)
      const bandMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(carLength - 0.6, 0.75),
        coachBandMat
      );
      bandMesh.position.set(carCenterX, 2.1, -coachWidth / 2 - 0.02);
      bandMesh.rotation.y = Math.PI;
      carGroup.add(bandMesh);

      // Spaced tinted windows along the cream band
      for (let windowOffset = 2.0; windowOffset < carLength - 2.0; windowOffset += 1.8) {
        const winPane = new THREE.Mesh(winPaneGeo, winPaneMat);
        winPane.position.set(carStartX + windowOffset, 2.1, -coachWidth / 2 - 0.025);
        winPane.rotation.y = Math.PI;
        carGroup.add(winPane);
      }

      // Curved corrugated roof
      const roofCylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(coachWidth / 2, coachWidth / 2, carLength - 0.4, 16, 1, false, 0, Math.PI),
        coachRoofMat
      );
      roofCylinder.rotation.z = Math.PI / 2;
      roofCylinder.position.set(carCenterX, coachHeight - 0.35, 0);
      roofCylinder.castShadow = true;
      carGroup.add(roofCylinder);

      // Yellow destination board
      const destBoardMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.45), destBoardMat);
      destBoardMesh.position.set(carCenterX, 1.25, -coachWidth / 2 - 0.02);
      destBoardMesh.rotation.y = Math.PI;
      carGroup.add(destBoardMesh);

      // Coach code label
      const codeLabel = coachCodes[carIndex % coachCodes.length];
      const codeTex = textures.textBoard ? textures.textBoard([codeLabel], { width: 256, height: 128, bg: '#1F4E9C', fg: '#FFFFFF' }) : null;
      const codeMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.32), new THREE.MeshStandardMaterial({ map: codeTex }));
      codeMesh.position.set(carStartX + 2.0, 2.1, -coachWidth / 2 - 0.02);
      codeMesh.rotation.y = Math.PI;
      carGroup.add(codeMesh);

      standingTrain.add(carGroup);
    }

    // Open door on Coach 1 at doorX (world doorX = 225.5, local x = 225.5 - 222 = 3.5)
    const localDoorX = levelTrain.doorX - levelTrain.rearX;
    const doorOpening = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 2.1),
      new THREE.MeshBasicMaterial({ color: '#0A0A0A' })
    );
    doorOpening.position.set(localDoorX, 1.45, -coachWidth / 2 - 0.03);
    doorOpening.rotation.y = Math.PI;
    standingTrain.add(doorOpening);

    // Warm lit vestibule interior inside the open door
    const litVestibule = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 2.2, 1.2),
      new THREE.MeshBasicMaterial({ color: '#FFE0B2' })
    );
    litVestibule.position.set(localDoorX, 1.5, -coachWidth / 2 + 0.6);
    standingTrain.add(litVestibule);

    // WAP-7 Electric Locomotive at the +X front
    const locoStartX = carCount * carLength;
    const locoCenterX = locoStartX + locoLength / 2;
    const locoGroup = new THREE.Group();

    const locoBody = new THREE.Mesh(
      new THREE.BoxGeometry(locoLength - 0.4, coachHeight - 0.5, coachWidth),
      new THREE.MeshStandardMaterial({ color: palette.locoRed || '#B3261E', roughness: 0.4 })
    );
    locoBody.position.set(locoCenterX, (coachHeight - 0.5) / 2 + 0.35, 0);
    locoBody.castShadow = true;
    locoBody.receiveShadow = true;
    locoGroup.add(locoBody);

    const locoStripe = new THREE.Mesh(
      new THREE.BoxGeometry(locoLength - 0.2, 0.45, coachWidth + 0.04),
      new THREE.MeshStandardMaterial({ color: palette.locoCream || '#F1E2B8', roughness: 0.5 })
    );
    locoStripe.position.set(locoCenterX, 2.0, 0);
    locoGroup.add(locoStripe);

    const pantoMat = new THREE.MeshStandardMaterial({ color: '#C62828', metalness: 0.7 });
    const pantoStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), pantoMat);
    pantoStem.position.set(locoCenterX + 4, coachHeight + 0.5, 0);
    pantoStem.rotation.z = 0.35;
    locoGroup.add(pantoStem);

    const pantoHead = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 2.0), pantoMat);
    pantoHead.position.set(locoCenterX + 4.4, coachHeight + 1.3, 0);
    locoGroup.add(pantoHead);

    standingTrain.add(locoGroup);
    scene.add(standingTrain);

    // -------------------------------------------------------------------------
    // 12. GUARD'S FLAG POLE (x = 218, z = 0, HEIGHT = 11)
    // -------------------------------------------------------------------------
    const flagSpec = level.flag || { x: 218, z: 0, height: 11 };
    const flagPole = new THREE.Group();
    flagPole.name = 'flagPole';
    flagPole.position.set(flagSpec.x, 0, flagSpec.z);

    const poleHeight = flagSpec.height || 11;
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.09, poleHeight, 12);
    const poleMat = new THREE.MeshStandardMaterial({ color: '#CFD8DC', metalness: 0.7, roughness: 0.3 });
    const poleMesh = new THREE.Mesh(poleGeo, poleMat);
    poleMesh.position.y = poleHeight / 2;
    poleMesh.castShadow = true;
    flagPole.add(poleMesh);

    const finialGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const finialMat = new THREE.MeshStandardMaterial({ color: '#FFD700', metalness: 0.8, roughness: 0.2 });
    const finialMesh = new THREE.Mesh(finialGeo, finialMat);
    finialMesh.position.y = poleHeight + 0.15;
    flagPole.add(finialMesh);

    const flagWidth = 1.4;
    const flagHeight = 0.9;
    const flagClothGeo = new THREE.PlaneGeometry(flagWidth, flagHeight, 6, 4);
    flagClothGeo.translate(flagWidth / 2, 0, 0);
    const flagClothMat = new THREE.MeshStandardMaterial({
      color: palette.flagGreen || '#1E9E3A',
      side: THREE.DoubleSide,
      roughness: 0.5,
    });
    const flagClothMesh = new THREE.Mesh(flagClothGeo, flagClothMat);
    flagClothMesh.position.set(0.08, poleHeight - 0.7, 0);
    flagClothMesh.castShadow = true;
    flagPole.add(flagClothMesh);

    flagPole.userData.flag = flagClothMesh;
    flagPole.userData.height = poleHeight;
    scene.add(flagPole);

    // -------------------------------------------------------------------------
    // 13. GOODS TRAINS ON TRACK 2 (BOXN WAGONS INSTANCEDMESH)
    // -------------------------------------------------------------------------
    const goodsTrainGroup = new THREE.Group();
    goodsTrainGroup.name = 'goodsTrainGroup';
    goodsTrainGroup.visible = false;

    // Diesel locomotive (WDG-4 in deep blue and safety yellow)
    const goodsLoco = new THREE.Group();
    const locoMainBody = new THREE.Mesh(
      new THREE.BoxGeometry(20, 3.8, 3.2),
      new THREE.MeshStandardMaterial({ color: '#0D47A1', roughness: 0.4 })
    );
    locoMainBody.castShadow = true;
    goodsLoco.add(locoMainBody);

    // Yellow chevron front safety beam
    const chevronBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.8, 3.2),
      new THREE.MeshStandardMaterial({ color: '#FFD100', roughness: 0.4 })
    );
    chevronBeam.position.set(-10.05, -1.2, 0);
    goodsLoco.add(chevronBeam);

    // Cab windshields
    const cabWindowMat = new THREE.MeshStandardMaterial({ color: '#0A1520', roughness: 0.2, metalness: 0.8 });
    const cabWinMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 1.2), cabWindowMat);
    cabWinMesh.position.set(-10.05, 0.8, 0);
    goodsLoco.add(cabWinMesh);

    goodsTrainGroup.add(goodsLoco);

    // Stencilled BOXN wagon texture
    const wagonTex = textures.canvasTexture
      ? textures.canvasTexture(512, 128, (context, width, height) => {
          context.fillStyle = palette.wagonBrown || '#6B3A24';
          context.fillRect(0, 0, width, height);
          context.fillStyle = 'rgba(0, 0, 0, 0.25)';
          for (let x = 16; x < width; x += 32) {
            context.fillRect(x, 0, 4, height);
          }
          context.fillStyle = '#FFFFFF';
          context.font = 'bold 24px monospace';
          context.fillText('CR  BOXN  548291', 32, 45);
          context.font = 'bold 16px sans-serif';
          context.fillText('IR BROAD GAUGE', 32, 75);
        }, { cacheKey: 'wagon_stencilled_tex' })
      : null;

    // 24 covered BOXN wagons (InstancedMesh: 1 draw call)
    const wagonBoxGeo = new THREE.BoxGeometry(13.5, 3.8, 3.2);
    const wagonBoxMat = new THREE.MeshStandardMaterial({
      map: wagonTex,
      roughness: 0.75,
    });
    const goodsWagonsMesh = new THREE.InstancedMesh(wagonBoxGeo, wagonBoxMat, 24);
    goodsWagonsMesh.castShadow = true;
    goodsWagonsMesh.receiveShadow = true;
    goodsTrainGroup.add(goodsWagonsMesh);

    scene.add(goodsTrainGroup);

    let currentPassIndex = -1;
    let locoWasWithin120 = false;

    // -------------------------------------------------------------------------
    // 14. UPDATE FUNCTION: ANIMATES AND RETURNS {HORN, RUMBLE}
    // -------------------------------------------------------------------------
    /**
     * Advances scenery animations and calculates ambient audio parameters.
     * @param {number} dt Frame delta time in seconds.
     * @param {number} time Total elapsed game time in seconds.
     * @param {!{x: number, y: number, z: number}} playerPos Current player position.
     * @return {!{horn: boolean, rumble: number}}
     */
    function update(dt, time, playerPos) {
      // Re-centre sky dome, sun disc, and cloud group on playerPos (x, 0, z)
      const px = playerPos && playerPos.x !== undefined ? playerPos.x : 0;
      const pz = playerPos && playerPos.z !== undefined ? playerPos.z : 0;

      skyMesh.position.set(px, 0, pz);
      sunDiscMesh.position.set(px + sunOffset.x, sunOffset.y, pz + sunOffset.z);
      cloudsGroup.position.set(px, 0, pz);

      // 1. Drift clouds relative to group centre along +X
      for (let index = 0; index < cloudSpheres.length; index++) {
        const cloud = cloudSpheres[index];
        cloud.position.x += dt * 2.5;
        if (cloud.position.x > 260) {
          cloud.position.x = -260;
        }
      }

      // 2. Animate drain pit water ripples
      if (waterTexClone) {
        waterTexClone.offset.x = (time * 0.04) % 1;
        waterTexClone.offset.y = (time * 0.02) % 1;
      }

      // 3. Smoke puffs rising and looping
      for (let index = 0; index < smokePuffs.length; index++) {
        const puff = smokePuffs[index];
        const cycle = ((time * 0.8 + puff.userData.offset) % 2.4) / 2.4;
        puff.position.y = puff.userData.baseY + cycle * 2.2;
        puff.scale.setScalar(0.7 + cycle * 0.9);
      }

      // 4. Flutter guard's flag cloth
      flagClothMesh.rotation.y = Math.sin(time * 6.0) * 0.22;

      // 5. Rotate clock hands
      const secProgress = (time % 60) / 60;
      const minProgress = (time % 3600) / 3600;
      for (let index = 0; index < clockHands.length; index++) {
        const hands = clockHands[index];
        hands.minHand.rotation.z = -secProgress * Math.PI * 2;
        hands.hourHand.rotation.z = -minProgress * Math.PI * 2;
      }

      // 6. NPC idle motions
      for (let index = 0; index < npcAnimators.length; index++) {
        npcAnimators[index](time);
      }

      // 7. Goods train on Track 2 simulation
      const firstPass = goodsTrainConfig.FIRST_PASS !== undefined ? goodsTrainConfig.FIRST_PASS : 14;
      const interval = goodsTrainConfig.INTERVAL !== undefined ? goodsTrainConfig.INTERVAL : 45;
      const speed = goodsTrainConfig.SPEED !== undefined ? goodsTrainConfig.SPEED : 18;
      const totalTrainLength = 20 + 24 * 14; // loco + 24 wagons = 356m
      const traverseDistance = 540; // from x = 380 to x = -160
      const passDuration = traverseDistance / speed; // 30 seconds

      let horn = false;
      let rumble = 0;

      if (time >= firstPass) {
        const timeSinceFirst = time - firstPass;
        const passIndex = Math.floor(timeSinceFirst / interval);
        const timeInPass = timeSinceFirst % interval;

        if (passIndex !== currentPassIndex) {
          currentPassIndex = passIndex;
          locoWasWithin120 = false;
        }

        if (timeInPass <= passDuration) {
          const isTowardNegX = passIndex % 2 === 0;
          const progress = timeInPass * speed;
          let locoX = 0;
          let rearX = 0;

          if (isTowardNegX) {
            locoX = 380 - progress;
            rearX = locoX + totalTrainLength;
            goodsLoco.position.set(locoX, railTopY + 1.9, track2Z);
            goodsLoco.rotation.y = 0;
            for (let i = 0; i < 24; i++) {
              const wagonCenter = locoX + 20 + i * 14 + 7;
              dummyMatrix.position.set(wagonCenter, railTopY + 1.9, track2Z);
              dummyMatrix.rotation.set(0, 0, 0);
              dummyMatrix.scale.set(1, 1, 1);
              dummyMatrix.updateMatrix();
              goodsWagonsMesh.setMatrixAt(i, dummyMatrix.matrix);
            }
          } else {
            locoX = -160 + progress;
            rearX = locoX - totalTrainLength;
            goodsLoco.position.set(locoX, railTopY + 1.9, track2Z);
            goodsLoco.rotation.y = Math.PI;
            for (let i = 0; i < 24; i++) {
              const wagonCenter = locoX - 20 - i * 14 - 7;
              dummyMatrix.position.set(wagonCenter, railTopY + 1.9, track2Z);
              dummyMatrix.rotation.set(0, Math.PI, 0);
              dummyMatrix.scale.set(1, 1, 1);
              dummyMatrix.updateMatrix();
              goodsWagonsMesh.setMatrixAt(i, dummyMatrix.matrix);
            }
          }
          goodsWagonsMesh.instanceMatrix.needsUpdate = true;
          goodsTrainGroup.visible = true;

          // Distance from player to train body
          const minTrainX = Math.min(locoX, rearX);
          const maxTrainX = Math.max(locoX, rearX);
          let distX = 0;
          if (playerPos.x < minTrainX) {
            distX = minTrainX - playerPos.x;
          } else if (playerPos.x > maxTrainX) {
            distX = playerPos.x - maxTrainX;
          }
          const dist3D = Math.hypot(distX, track2Z - playerPos.z, railTopY - playerPos.y);
          rumble = Math.max(0, Math.min(1, 1 - dist3D / 80));

          // Horn: true on the frame an approaching loco comes within 120m of player along X
          const distLocoX = Math.abs(locoX - playerPos.x);
          const isApproaching = isTowardNegX ? locoX > playerPos.x : locoX < playerPos.x;
          const withinThreshold = isApproaching && distLocoX <= 120;

          if (withinThreshold && !locoWasWithin120) {
            horn = true;
            locoWasWithin120 = true;
          }
          if (!withinThreshold && distLocoX > 130) {
            locoWasWithin120 = false;
          }
        } else {
          goodsTrainGroup.visible = false;
          locoWasWithin120 = false;
        }
      } else {
        goodsTrainGroup.visible = false;
      }

      return {
        horn: horn,
        rumble: rumble,
      };
    }

    return {
      sun: sun,
      standingTrain: standingTrain,
      flagPole: flagPole,
      update: update,
    };
  }

  const Scenery = {
    build: build,
  };

  KUDLA.Scenery = Scenery;
  if (typeof module === 'object' && module.exports) {
    module.exports = Scenery;
  }
})(typeof window !== 'undefined' ? window : globalThis);
