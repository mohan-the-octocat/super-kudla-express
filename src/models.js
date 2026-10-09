/**
 * @fileoverview Dynamic 3D models and animation for Super Kudla Express.
 * Strictly implements DESIGN.md sections 4 and 7.2.
 * Origin rule: bottom-centre (min.y ~ 0, centred in X/Z), except createBlock which is centred.
 * Facing rule: faces local +Z.
 */
(function (root) {
  'use strict';
  const KUDLA = (root.KUDLA = root.KUDLA || {});

  // Cache for shared geometries and materials
  const sharedGeometries = {};
  const sharedMaterials = {};
  const popupTextureCache = new Map();

  function getThree() {
    return root.THREE || (typeof window !== 'undefined' ? window.THREE : globalThis.THREE);
  }

  function getPalette() {
    return (KUDLA.Config && KUDLA.Config.PALETTE) || {};
  }

  // --- Geometry and Material Helpers ---

  function getBlockGeometry() {
    const THREE = getThree();
    if (!sharedGeometries.block) {
      sharedGeometries.block = new THREE.BoxGeometry(1, 1, 1);
    }
    return sharedGeometries.block;
  }

  function getBlockMaterial(kind) {
    const THREE = getThree();
    const textures = KUDLA.Textures;
    if (!sharedMaterials['block_' + kind]) {
      const palette = getPalette();
      if (kind === 'mystery') {
        sharedMaterials['block_' + kind] = new THREE.MeshStandardMaterial({
          map: textures ? textures.mysteryBlock() : null,
          color: '#FFFFFF',
          emissive: palette.gold || '#F4B41A',
          emissiveIntensity: 0.18,
          roughness: 0.4,
          metalness: 0.2,
        });
      } else if (kind === 'used') {
        sharedMaterials['block_' + kind] = new THREE.MeshStandardMaterial({
          map: textures ? textures.usedBlock() : null,
          roughness: 0.9,
          metalness: 0.0,
        });
      } else if (kind === 'laterite') {
        sharedMaterials['block_' + kind] = new THREE.MeshStandardMaterial({
          map: textures ? textures.laterite() : null,
          roughness: 0.95,
          metalness: 0.0,
        });
      } else {
        // tile
        sharedMaterials['block_' + kind] = new THREE.MeshStandardMaterial({
          map: textures ? textures.tileBlock() : null,
          roughness: 0.8,
          metalness: 0.1,
        });
      }
    }
    return sharedMaterials['block_' + kind];
  }

  function getCashewGeometry() {
    const THREE = getThree();
    if (!sharedGeometries.cashew) {
      const shape = new THREE.Shape();
      // Classic Kudla golden cashew kidney curve
      shape.moveTo(0.05, -0.28);
      shape.bezierCurveTo(0.32, -0.25, 0.38, 0.05, 0.22, 0.30);
      shape.bezierCurveTo(0.14, 0.35, 0.02, 0.34, -0.08, 0.26);
      shape.bezierCurveTo(0.04, 0.12, 0.02, -0.08, -0.16, -0.16);
      shape.bezierCurveTo(-0.24, -0.22, -0.12, -0.30, 0.05, -0.28);

      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.26,
        bevelEnabled: true,
        bevelSegments: 3,
        steps: 1,
        bevelSize: 0.06,
        bevelThickness: 0.06,
      });
      geometry.center();
      geometry.computeBoundingBox();

      const box = geometry.boundingBox;
      const currentWidth = box.max.x - box.min.x;
      const currentHeight = box.max.y - box.min.y;
      const currentDepth = box.max.z - box.min.z;
      // Target 0.58 x 0.58 x 0.54 (fits 0.6 cube)
      geometry.scale(0.58 / currentWidth, 0.58 / currentHeight, 0.54 / currentDepth);
      geometry.computeBoundingBox();
      // Offset so min.y is exactly 0.0 (bottom-centre origin)
      geometry.translate(0, -geometry.boundingBox.min.y, 0);
      geometry.computeBoundingBox();
      sharedGeometries.cashew = geometry;
    }
    return sharedGeometries.cashew;
  }

  function getCashewMaterial() {
    const THREE = getThree();
    if (!sharedMaterials.cashew) {
      const palette = getPalette();
      sharedMaterials.cashew = new THREE.MeshStandardMaterial({
        color: palette.cashew || '#E9B949',
        emissive: '#442800',
        metalness: 0.45,
        roughness: 0.25,
      });
    }
    return sharedMaterials.cashew;
  }

  function getShardGeometry() {
    const THREE = getThree();
    if (!sharedGeometries.shard) {
      sharedGeometries.shard = new THREE.TetrahedronGeometry(0.12);
    }
    return sharedGeometries.shard;
  }

  function getShardMaterial() {
    const THREE = getThree();
    if (!sharedMaterials.shard) {
      const palette = getPalette();
      sharedMaterials.shard = new THREE.MeshStandardMaterial({
        color: palette.terracotta || '#C2512A',
        roughness: 0.8,
      });
    }
    return sharedMaterials.shard;
  }

  // --- Public Factories ---

  /**
   * Creates a 1x1x1 centred block mesh.
   * @param {string} kind 'tile' | 'mystery' | 'used' | 'laterite'
   * @return {!THREE.Mesh}
   */
  function createBlock(kind) {
    const THREE = getThree();
    const mesh = new THREE.Mesh(getBlockGeometry(), getBlockMaterial(kind));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.kind = 'block';
    mesh.userData.blockKind = kind;
    return mesh;
  }

  /**
   * Swaps the material and userData of a block mesh.
   * @param {!THREE.Mesh} mesh
   * @param {string} kind
   */
  function setBlockKind(mesh, kind) {
    mesh.material = getBlockMaterial(kind);
    mesh.userData.blockKind = kind;
  }

  /**
   * Creates a kidney-shaped golden cashew fitting a 0.6 cube.
   * @return {!THREE.Mesh}
   */
  function createCashew() {
    const THREE = getThree();
    const mesh = new THREE.Mesh(getCashewGeometry(), getCashewMaterial());
    mesh.castShadow = true;
    mesh.userData.kind = 'cashew';
    return mesh;
  }

  /**
   * Creates an item model fitting a 0.8 cube.
   * @param {string} type 'buns' | 'gheeroast' | 'gadbad' | 'coconut'
   * @return {!THREE.Group}
   */
  function createItem(type) {
    const THREE = getThree();
    const group = new THREE.Group();
    const palette = getPalette();

    if (type === 'buns') {
      // Banana leaf base
      const leafGeometry = new THREE.BoxGeometry(0.76, 0.04, 0.76);
      const leafMaterial = new THREE.MeshStandardMaterial({
        color: palette.leaf || '#3E8E41',
        roughness: 0.6,
      });
      const leafMesh = new THREE.Mesh(leafGeometry, leafMaterial);
      leafMesh.position.y = 0.02;
      group.add(leafMesh);

      // Puffy golden-brown Mangalore bun
      const bunGeometry = new THREE.CylinderGeometry(0.34, 0.36, 0.38, 16);
      const bunMaterial = new THREE.MeshStandardMaterial({
        color: '#D48C38',
        roughness: 0.5,
      });
      const bunMesh = new THREE.Mesh(bunGeometry, bunMaterial);
      bunMesh.position.y = 0.23;
      group.add(bunMesh);

      // Top puff dome
      const domeGeometry = new THREE.SphereGeometry(0.34, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
      const domeMaterial = new THREE.MeshStandardMaterial({
        color: '#E8A548',
        roughness: 0.4,
      });
      const domeMesh = new THREE.Mesh(domeGeometry, domeMaterial);
      domeMesh.position.y = 0.42;
      group.add(domeMesh);
    } else if (type === 'gheeroast') {
      // Brass bowl
      const bowlGeometry = new THREE.CylinderGeometry(0.38, 0.26, 0.32, 16, 1, true);
      const brassMaterial = new THREE.MeshStandardMaterial({
        color: '#D4AF37',
        metalness: 0.7,
        roughness: 0.2,
        side: THREE.DoubleSide,
      });
      const bowlMesh = new THREE.Mesh(bowlGeometry, brassMaterial);
      bowlMesh.position.y = 0.16;
      group.add(bowlMesh);

      // Deep red ghee roast chunks
      const roastGeometry = new THREE.SphereGeometry(0.33, 12, 8);
      const roastMaterial = new THREE.MeshStandardMaterial({
        color: '#8A1508',
        roughness: 0.25,
      });
      const roastMesh = new THREE.Mesh(roastGeometry, roastMaterial);
      roastMesh.position.y = 0.28;
      group.add(roastMesh);

      // Two red chillies
      const chilliGeometry = new THREE.ConeGeometry(0.06, 0.36, 8);
      const chilliMaterial = new THREE.MeshStandardMaterial({
        color: palette.chilli || '#D7261E',
        roughness: 0.3,
      });
      const chilli1 = new THREE.Mesh(chilliGeometry, chilliMaterial);
      chilli1.position.set(-0.10, 0.48, 0.05);
      chilli1.rotation.z = 0.5;
      group.add(chilli1);

      const chilli2 = new THREE.Mesh(chilliGeometry, chilliMaterial);
      chilli2.position.set(0.12, 0.46, -0.05);
      chilli2.rotation.z = -0.4;
      group.add(chilli2);
    } else if (type === 'gadbad') {
      // Tall glass with 4 layers
      const glassGeometry = new THREE.CylinderGeometry(0.34, 0.22, 0.60, 16);
      const glassMaterial = new THREE.MeshStandardMaterial({
        color: '#E0F7FA',
        transparent: true,
        opacity: 0.4,
        roughness: 0.1,
      });
      const glassMesh = new THREE.Mesh(glassGeometry, glassMaterial);
      glassMesh.position.y = 0.30;
      group.add(glassMesh);

      // 4 Ice cream layers
      const layerColors = ['#3D2010', '#44AA55', '#FFD54F', '#FF69B4'];
      layerColors.forEach((layerColor, index) => {
        const layerGeo = new THREE.CylinderGeometry(0.24 + index * 0.02, 0.22 + index * 0.02, 0.12, 12);
        const layerMat = new THREE.MeshStandardMaterial({ color: layerColor, roughness: 0.4 });
        const layerMesh = new THREE.Mesh(layerGeo, layerMat);
        layerMesh.position.y = 0.08 + index * 0.13;
        group.add(layerMesh);
      });

      // Cherry on top
      const cherryGeometry = new THREE.SphereGeometry(0.09, 12, 12);
      const cherryMaterial = new THREE.MeshStandardMaterial({
        color: '#D50000',
        emissive: '#440000',
        roughness: 0.1,
      });
      const cherryMesh = new THREE.Mesh(cherryGeometry, cherryMaterial);
      cherryMesh.position.y = 0.67;
      group.add(cherryMesh);
      group.userData.pulseMaterial = cherryMaterial;
    } else {
      // coconut
      const coconutGeometry = new THREE.SphereGeometry(0.36, 16, 14);
      const coconutMaterial = new THREE.MeshStandardMaterial({
        color: '#388E3C',
        roughness: 0.5,
      });
      const coconutMesh = new THREE.Mesh(coconutGeometry, coconutMaterial);
      coconutMesh.position.y = 0.36;
      group.add(coconutMesh);

      // Cut top cream face
      const cutGeometry = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 16);
      const cutMaterial = new THREE.MeshStandardMaterial({
        color: '#FFF8DC',
        roughness: 0.3,
      });
      const cutMesh = new THREE.Mesh(cutGeometry, cutMaterial);
      cutMesh.position.y = 0.70;
      group.add(cutMesh);

      // Striped straw
      const strawGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.26, 8);
      const strawMaterial = new THREE.MeshStandardMaterial({
        color: '#E53935',
        roughness: 0.2,
      });
      const strawMesh = new THREE.Mesh(strawGeometry, strawMaterial);
      strawMesh.position.set(0.06, 0.78, 0);
      strawMesh.rotation.z = -0.35;
      group.add(strawMesh);
    }

    // Ensure children cast shadows
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });

    group.userData.kind = 'item';
    group.userData.itemType = type;
    return group;
  }

  /**
   * Creates an enemy model (Denji crab, Indian house crow, chimney crow).
   * @param {string} type 'crab' | 'crow' | 'chimney_crow'
   * @return {!THREE.Group}
   */
  function createEnemy(type) {
    const THREE = getThree();
    const group = new THREE.Group();
    const palette = getPalette();

    if (type === 'crab') {
      // Orange-red shell
      const shellGeo = new THREE.BoxGeometry(0.56, 0.24, 0.46);
      const shellMat = new THREE.MeshStandardMaterial({
        color: palette.crab || '#E2572B',
        roughness: 0.4,
      });
      const shell = new THREE.Mesh(shellGeo, shellMat);
      shell.position.y = 0.30;
      group.add(shell);

      // Eye stalks
      const stalkGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8);
      const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
      const eyeWhite = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.2 });
      const pupilGeo = new THREE.SphereGeometry(0.025, 6, 6);
      const pupilMat = new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.1 });

      [-0.10, 0.10].forEach((stalkX) => {
        const stalk = new THREE.Mesh(stalkGeo, shellMat);
        stalk.position.set(stalkX, 0.46, 0.15);
        group.add(stalk);

        const eye = new THREE.Mesh(eyeGeo, eyeWhite);
        eye.position.set(stalkX, 0.54, 0.15);
        group.add(eye);

        const pupil = new THREE.Mesh(pupilGeo, pupilMat);
        pupil.position.set(stalkX, 0.54, 0.19);
        group.add(pupil);
      });

      // Claws (left and right extending forward to z = +0.42)
      const armGeo = new THREE.BoxGeometry(0.10, 0.08, 0.24);
      const clawGeo = new THREE.BoxGeometry(0.12, 0.16, 0.18);

      const leftArm = new THREE.Group();
      leftArm.position.set(-0.28, 0.32, 0.16);
      const leftArmMesh = new THREE.Mesh(armGeo, shellMat);
      leftArmMesh.position.z = 0.12;
      leftArm.add(leftArmMesh);
      const leftClawMesh = new THREE.Mesh(clawGeo, shellMat);
      leftClawMesh.position.set(-0.04, 0.08, 0.26);
      leftArm.add(leftClawMesh);
      group.add(leftArm);

      const rightArm = new THREE.Group();
      rightArm.position.set(0.28, 0.32, 0.16);
      const rightArmMesh = new THREE.Mesh(armGeo, shellMat);
      rightArmMesh.position.z = 0.12;
      rightArm.add(rightArmMesh);
      const rightClawMesh = new THREE.Mesh(clawGeo, shellMat);
      rightClawMesh.position.set(0.04, 0.08, 0.26);
      rightArm.add(rightClawMesh);
      group.add(rightArm);

      // 6 scuttling legs spanning Z from -0.42 to +0.10
      const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.36, 6);
      const legs = [];
      const zOffsets = [-0.22, -0.06, 0.10];
      for (let i = 0; i < 6; i++) {
        const side = i < 3 ? -1 : 1;
        const indexInSide = i % 3;
        const legGroup = new THREE.Group();
        legGroup.position.set(side * 0.26, 0.26, zOffsets[indexInSide]);

        const legMesh = new THREE.Mesh(legGeo, shellMat);
        legMesh.position.set(side * 0.12, -0.11, (indexInSide === 0) ? -0.10 : 0);
        legMesh.rotation.z = side * 0.7;
        if (indexInSide === 0) {
          legMesh.rotation.x = 0.4;
        }
        legGroup.add(legMesh);
        group.add(legGroup);
        legs.push(legGroup);
      }

      group.userData.parts = {
        leftClaw: leftArm,
        rightClaw: rightArm,
        legs: legs,
      };
    } else if (type === 'crow') {
      // Indian house crow: black body, grey nape
      const bodyGeo = new THREE.ConeGeometry(0.18, 0.50, 10);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: palette.crow || '#1B1B1F',
        roughness: 0.7,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.rotation.x = Math.PI * 0.45;
      bodyMesh.position.set(0, 0.25, -0.05);
      group.add(bodyMesh);

      // Grey nape collar
      const napeGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.12, 10);
      const napeMat = new THREE.MeshStandardMaterial({
        color: palette.crowNape || '#6C6F75',
        roughness: 0.8,
      });
      const napeMesh = new THREE.Mesh(napeGeo, napeMat);
      napeMesh.position.set(0, 0.36, 0.10);
      group.add(napeMesh);

      // Head and Beak
      const headGeo = new THREE.SphereGeometry(0.11, 8, 8);
      const headMesh = new THREE.Mesh(headGeo, bodyMat);
      headMesh.position.set(0, 0.42, 0.16);
      group.add(headMesh);

      const beakGeo = new THREE.ConeGeometry(0.045, 0.16, 6);
      const beakMat = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.3 });
      const beakMesh = new THREE.Mesh(beakGeo, beakMat);
      beakMesh.rotation.x = Math.PI * 0.5;
      beakMesh.position.set(0, 0.41, 0.28);
      group.add(beakMesh);

      // Wings
      const wingGeo = new THREE.BoxGeometry(0.34, 0.02, 0.24);
      const leftWing = new THREE.Mesh(wingGeo, bodyMat);
      leftWing.position.set(-0.21, 0.30, 0);
      group.add(leftWing);

      const rightWing = new THREE.Mesh(wingGeo, bodyMat);
      rightWing.position.set(0.21, 0.30, 0);
      group.add(rightWing);

      group.userData.parts = {
        leftWing,
        rightWing,
        body: bodyMesh,
      };
    } else {
      // chimney_crow: perched upright posture, beak open
      const bodyGeo = new THREE.CylinderGeometry(0.18, 0.20, 0.48, 10);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: palette.crow || '#1B1B1F',
        roughness: 0.7,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.position.set(0, 0.46, 0);
      group.add(bodyMesh);

      // Standing legs
      const legGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.24, 6);
      const legMat = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.5 });
      [-0.10, 0.10].forEach((lx) => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, 0.12, 0);
        group.add(leg);
      });

      // Grey nape
      const napeGeo = new THREE.CylinderGeometry(0.15, 0.16, 0.14, 10);
      const napeMat = new THREE.MeshStandardMaterial({
        color: palette.crowNape || '#6C6F75',
        roughness: 0.8,
      });
      const napeMesh = new THREE.Mesh(napeGeo, napeMat);
      napeMesh.position.set(0, 0.68, 0.02);
      group.add(napeMesh);

      // Head
      const headGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const headMesh = new THREE.Mesh(headGeo, bodyMat);
      headMesh.position.set(0, 0.78, 0.10);
      group.add(headMesh);

      // Open beak (two angled cones reaching forward to z = +0.38)
      const beakMat = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.3 });
      const upperBeak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.20, 6), beakMat);
      upperBeak.rotation.x = Math.PI * 0.42;
      upperBeak.position.set(0, 0.81, 0.28);
      group.add(upperBeak);

      const lowerBeak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 6), beakMat);
      lowerBeak.rotation.x = Math.PI * 0.58;
      lowerBeak.position.set(0, 0.75, 0.27);
      group.add(lowerBeak);

      // Tail feathers extending backward to z = -0.38
      const tailGeo = new THREE.BoxGeometry(0.18, 0.03, 0.36);
      const tailMesh = new THREE.Mesh(tailGeo, bodyMat);
      tailMesh.position.set(0, 0.30, -0.20);
      tailMesh.rotation.x = -0.35;
      group.add(tailMesh);

      // Perched wings spanning to width ~0.76 (CHIMNEY_CROW_SIZE.w = 0.8)
      const wingGeo = new THREE.BoxGeometry(0.34, 0.04, 0.22);
      const leftWing = new THREE.Mesh(wingGeo, bodyMat);
      leftWing.position.set(-0.22, 0.46, 0);
      leftWing.rotation.z = 0.25;
      group.add(leftWing);

      const rightWing = new THREE.Mesh(wingGeo, bodyMat);
      rightWing.position.set(0.22, 0.46, 0);
      rightWing.rotation.z = -0.25;
      group.add(rightWing);

      group.userData.parts = {
        leftWing,
        rightWing,
        head: headMesh,
      };
    }

    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });

    group.userData.kind = 'enemy';
    group.userData.enemyType = type;
    return group;
  }

  /**
   * Creates a glowing chilli fireball fitting a 0.5 cube.
   * @return {!THREE.Group}
   */
  function createFireball() {
    const THREE = getThree();
    const group = new THREE.Group();
    const palette = getPalette();

    const chilliGeo = new THREE.ConeGeometry(0.23, 0.42, 12);
    const chilliMat = new THREE.MeshStandardMaterial({
      color: palette.chilli || '#D7261E',
      emissive: '#771510',
      emissiveIntensity: 0.4,
      roughness: 0.25,
    });
    const chilliMesh = new THREE.Mesh(chilliGeo, chilliMat);
    chilliMesh.position.y = 0.21;
    group.add(chilliMesh);

    const stemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.08, 6);
    const stemMat = new THREE.MeshStandardMaterial({
      color: palette.leaf || '#3E8E41',
      roughness: 0.5,
    });
    const stemMesh = new THREE.Mesh(stemGeo, stemMat);
    stemMesh.position.y = 0.46;
    group.add(stemMesh);

    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });

    group.userData.kind = 'fireball';
    return group;
  }

  /**
   * Creates the player model (third-person traveller) with named parts.
   * @return {!THREE.Group}
   */
  function createPlayer() {
    const THREE = getThree();
    const group = new THREE.Group();
    const palette = getPalette();

    // Shared materials for shirt swapping
    if (!sharedMaterials.playerBlueShirt) {
      sharedMaterials.playerBlueShirt = new THREE.MeshStandardMaterial({
        color: palette.coachBlue || '#1F4E9C',
        roughness: 0.6,
      });
    }
    if (!sharedMaterials.playerFireShirt) {
      sharedMaterials.playerFireShirt = new THREE.MeshStandardMaterial({
        color: palette.chilli || '#D7261E',
        roughness: 0.6,
      });
    }

    const skinMat = new THREE.MeshStandardMaterial({ color: '#C68642', roughness: 0.7 });
    const capMat = new THREE.MeshStandardMaterial({ color: '#C62828', roughness: 0.5 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: '#5D4037', roughness: 0.8 });
    const packMat = new THREE.MeshStandardMaterial({ color: '#FBC02D', roughness: 0.5 });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.32, 0.38, 0.20);
    const torso = new THREE.Mesh(torsoGeo, sharedMaterials.playerBlueShirt);
    torso.position.y = 0.62;
    torso.userData.baseY = 0.62;
    group.add(torso);

    // Backpack (attached to rear: -Z, spans to z = -0.27)
    const packGeo = new THREE.BoxGeometry(0.24, 0.28, 0.22);
    const backpack = new THREE.Mesh(packGeo, packMat);
    backpack.position.set(0, 0.62, -0.16);
    group.add(backpack);

    // Head and Cap
    const headGeo = new THREE.SphereGeometry(0.12, 10, 10);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 0.92, 0);
    group.add(head);

    const capGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 12);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(0, 1.02, 0);
    group.add(cap);

    const brimGeo = new THREE.BoxGeometry(0.18, 0.02, 0.10);
    const brim = new THREE.Mesh(brimGeo, capMat);
    brim.position.set(0, 0.99, 0.12);
    group.add(brim);

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.34, 8);
    armGeo.translate(0, -0.17, 0);

    const leftArm = new THREE.Mesh(armGeo, sharedMaterials.playerBlueShirt);
    leftArm.position.set(-0.21, 0.78, 0);
    group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, sharedMaterials.playerBlueShirt);
    rightArm.position.set(0.21, 0.78, 0);
    group.add(rightArm);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.43, 8);
    legGeo.translate(0, -0.215, 0);

    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.09, 0.43, 0);
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.09, 0.43, 0);
    group.add(rightLeg);

    // Shoes (feet facing +Z, spans to z = +0.27)
    const shoeGeo = new THREE.BoxGeometry(0.12, 0.06, 0.22);
    const shoeMat = new THREE.MeshStandardMaterial({ color: '#3E2723', roughness: 0.9 });
    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
    leftShoe.position.set(-0.09, 0.03, 0.16);
    group.add(leftShoe);

    const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rightShoe.position.set(0.09, 0.03, 0.16);
    group.add(rightShoe);

    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
      }
    });

    group.userData.kind = 'player';
    group.userData.power = 'small';
    group.userData.parts = {
      torso,
      backpack,
      head,
      cap,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
    };

    return group;
  }

  /**
   * Sets player power state (small: 1.1m, big: 1.8m, fire: 1.8m with orange-red shirt).
   * @param {!THREE.Group} player
   * @param {string} power 'small' | 'big' | 'fire'
   */
  function setPlayerPower(player, power) {
    const parts = player.userData.parts;
    const isFire = (power === 'fire');
    const shirtMat = isFire ? sharedMaterials.playerFireShirt : sharedMaterials.playerBlueShirt;

    if (parts) {
      if (parts.torso) parts.torso.material = shirtMat;
      if (parts.leftArm) parts.leftArm.material = shirtMat;
      if (parts.rightArm) parts.rightArm.material = shirtMat;
    }

    if (power === 'small') {
      player.scale.set(1.0, 1.0, 1.0);
    } else {
      // Scale Y to reach 1.80m, scale X/Z slightly to stay within PLAYER_WIDTH (0.6)
      player.scale.set(1.05, 1.8 / 1.1, 1.05);
    }

    player.userData.power = power;
  }

  /**
   * Creates a small terracotta tile shard mesh.
   * @return {!THREE.Mesh}
   */
  function createShard() {
    const THREE = getThree();
    const mesh = new THREE.Mesh(getShardGeometry(), getShardMaterial());
    mesh.castShadow = true;
    mesh.userData.kind = 'shard';
    return mesh;
  }

  /**
   * Creates a floating score popup sprite with white text and dark outline.
   * @param {string|number} text
   * @return {!THREE.Sprite}
   */
  function createScorePopup(text) {
    const THREE = getThree();
    const stringText = String(text);

    let texture = popupTextureCache.get(stringText);
    if (!texture) {
      const canvas = (typeof document !== 'undefined' && document.createElement)
        ? document.createElement('canvas')
        : null;
      if (canvas) {
        canvas.width = 320;
        canvas.height = 96;
        const context = canvas.getContext('2d');
        if (context) {
          context.clearRect(0, 0, 320, 96);
          const fontSize = stringText.length > 7 ? 40 : 52;
          context.font = 'bold ' + fontSize + 'px "Baloo 2", "Trebuchet MS", sans-serif';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.lineWidth = 8;
          context.strokeStyle = '#151515';
          context.strokeText(stringText, 160, 48);
          context.fillStyle = '#FFFFFF';
          context.fillText(stringText, 160, 48);
        }
        texture = new THREE.CanvasTexture(canvas);
        texture.encoding = THREE.sRGBEncoding;
        popupTextureCache.set(stringText, texture);
      }
    }

    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.4, 0.52, 1);
    sprite.renderOrder = 999;
    sprite.userData.kind = 'score_popup';
    sprite.userData.text = stringText;
    return sprite;
  }

  /**
   * Animates a model deterministically and idempotently for given (time, state).
   * @param {!THREE.Object3D} object
   * @param {number} time Elapsed time in seconds.
   * @param {string=} state Animation state.
   * @param {*=} extra Extra state parameter (e.g. speed).
   */
  function animate(object, time, state, extra) {
    const kind = object.userData.kind;

    if (kind === 'cashew') {
      object.rotation.y = time * 3.0;
    } else if (kind === 'item') {
      object.rotation.y = time * 1.5;
      if (object.userData.pulseMaterial) {
        object.userData.pulseMaterial.emissive.setHSL((time * 0.5) % 1, 0.8, 0.25);
      }
    } else if (kind === 'fireball') {
      object.rotation.x = time * 8.0;
      object.rotation.z = time * 6.0;
    } else if (kind === 'block') {
      if (state === 'bump') {
        const fraction = Math.min(1, Math.max(0, (time % 0.2) / 0.2));
        object.position.y = (object.userData.baseY || 0) + Math.sin(fraction * Math.PI) * 0.3;
      }
    } else if (kind === 'enemy') {
      const enemyType = object.userData.enemyType;
      const parts = object.userData.parts;
      if (enemyType === 'crab') {
        if (state === 'squashed') {
          object.scale.set(1.2, 0.3, 1.2);
          object.rotation.z = 0;
        } else if (state === 'dead') {
          object.scale.set(1.0, 1.0, 1.0);
          object.rotation.z = Math.PI;
        } else {
          object.scale.set(1.0, 1.0, 1.0);
          object.rotation.z = 0;
          if (parts) {
            if (parts.legs) {
              for (let i = 0; i < parts.legs.length; i++) {
                const phase = (i * Math.PI) / 3;
                parts.legs[i].rotation.z = Math.sin(time * 10 + phase) * 0.2;
              }
            }
            if (parts.leftClaw) {
              parts.leftClaw.rotation.x = Math.sin(time * 6) * 0.25;
            }
            if (parts.rightClaw) {
              parts.rightClaw.rotation.x = -Math.sin(time * 6) * 0.25;
            }
          }
        }
      } else if (enemyType === 'crow' || enemyType === 'chimney_crow') {
        if (state === 'dead') {
          object.rotation.x = Math.PI;
        } else {
          object.rotation.x = 0;
          if (parts) {
            const wingAngle = Math.sin(time * 12) * 0.5;
            if (parts.leftWing) parts.leftWing.rotation.z = wingAngle;
            if (parts.rightWing) parts.rightWing.rotation.z = -wingAngle;
          }
        }
      }
    } else if (kind === 'player') {
      const parts = object.userData.parts;
      if (parts) {
        if (state === 'jump') {
          if (parts.leftArm) parts.leftArm.rotation.x = -2.2;
          if (parts.rightArm) parts.rightArm.rotation.x = -2.2;
          if (parts.leftLeg) parts.leftLeg.rotation.x = 0.5;
          if (parts.rightLeg) parts.rightLeg.rotation.x = -0.3;
          if (parts.torso) parts.torso.position.y = parts.torso.userData.baseY || 0.62;
        } else if (state === 'run') {
          const speed = typeof extra === 'number' ? extra : 8.0;
          const legAngle = Math.sin(time * speed) * 0.7;
          if (parts.leftLeg) parts.leftLeg.rotation.x = legAngle;
          if (parts.rightLeg) parts.rightLeg.rotation.x = -legAngle;
          if (parts.leftArm) parts.leftArm.rotation.x = -legAngle * 0.8;
          if (parts.rightArm) parts.rightArm.rotation.x = legAngle * 0.8;
          if (parts.torso) {
            const baseY = parts.torso.userData.baseY || 0.62;
            parts.torso.position.y = baseY + Math.abs(Math.sin(time * speed * 2)) * 0.03;
          }
        } else {
          // idle
          const breath = Math.sin(time * 2.0) * 0.02;
          if (parts.leftArm) parts.leftArm.rotation.x = breath;
          if (parts.rightArm) parts.rightArm.rotation.x = breath;
          if (parts.leftLeg) parts.leftLeg.rotation.x = 0;
          if (parts.rightLeg) parts.rightLeg.rotation.x = 0;
          if (parts.torso) {
            const baseY = parts.torso.userData.baseY || 0.62;
            parts.torso.position.y = baseY + breath;
          }
        }
      }
    }
  }

  const Models = {
    createBlock,
    setBlockKind,
    createCashew,
    createItem,
    createEnemy,
    createFireball,
    createPlayer,
    setPlayerPower,
    createShard,
    createScorePopup,
    animate,
  };

  KUDLA.Models = Models;
  if (typeof module === 'object' && module.exports) {
    module.exports = Models;
  }
})(typeof window !== 'undefined' ? window : globalThis);
