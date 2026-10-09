/**
 * @fileoverview Pure-logic physics engine for Super Kudla Express.
 * Implements 3D AABB swept movement, collision resolution, player kinematics,
 * enemy interaction classification, walker movement, and fireballs per DESIGN.md §6.
 */
(function (root) {
  'use strict';
  const KUDLA = (root.KUDLA = root.KUDLA || {});

  /**
   * Constructs an axis-aligned bounding box from center (x, z) and bottom y.
   * @param {number} x Box center X.
   * @param {number} y Box bottom Y.
   * @param {number} z Box center Z.
   * @param {number} width Span along X.
   * @param {number} height Span along Y.
   * @param {number} depth Span along Z.
   * @return {!{minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number}}
   */
  function makeAABB(x, y, z, width, height, depth) {
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    return {
      minX: x - halfWidth,
      maxX: x + halfWidth,
      minY: y,
      maxY: y + height,
      minZ: z - halfDepth,
      maxZ: z + halfDepth,
    };
  }

  /**
   * Converts a level box {x, y, z, w, h, d} to an AABB.
   * @param {!{x: number, y: number, z: number, w: number, h: number, d: number}} box
   * @return {!{minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number}}
   */
  function boxToAABB(box) {
    return makeAABB(box.x, box.y, box.z, box.w, box.h, box.d);
  }

  /**
   * Converts a dynamic body {x, y, z, width, height, depth} to an AABB.
   * @param {!{x: number, y: number, z: number, width: number, height: number, depth?: number}} body
   * @return {!{minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number}}
   */
  function bodyAABB(body) {
    const depth = body.depth !== undefined ? body.depth : body.width;
    return makeAABB(body.x, body.y, body.z, body.width, body.height, depth);
  }

  /**
   * Tests strict overlap greater than COLLISION_EPSILON on all 3 axes.
   * @param {!{minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number}} boxA
   * @param {!{minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number}} boxB
   * @return {boolean} True if strictly overlapping on all axes.
   */
  function intersects(boxA, boxB) {
    const eps = KUDLA.Config.COLLISION_EPSILON;
    const overlapX = Math.min(boxA.maxX, boxB.maxX) - Math.max(boxA.minX, boxB.minX);
    const overlapY = Math.min(boxA.maxY, boxB.maxY) - Math.max(boxA.minY, boxB.minY);
    const overlapZ = Math.min(boxA.maxZ, boxB.maxZ) - Math.max(boxA.minZ, boxB.minZ);
    return overlapX > eps && overlapY > eps && overlapZ > eps;
  }

  /**
   * Advances a physical body by dt against static colliders.
   * Moves and resolves per-axis: Y velocity integration, X movement, Z movement, Y movement.
   * @param {!Object} body Dynamic body with {x, y, z, vx, vy, vz, width, height, depth, onGround}.
   * @param {number} dt Fixed timestep in seconds.
   * @param {!Array<{aabb: Object, ref: Object}>} colliders Array of colliders.
   * @param {?Object} options Optional gravity and maxFall overrides.
   * @return {!{onGround: boolean, landedOn: ?Object, hitHead: ?Object, hitWallX: boolean, hitWallZ: boolean, wallRefs: !Array<Object>}}
   */
  function stepBody(body, dt, colliders, options) {
    const Config = KUDLA.Config;
    const gravity = options && options.gravity !== undefined ? options.gravity : Config.GRAVITY;
    const maxFall = options && options.maxFall !== undefined ? options.maxFall : Config.MAX_FALL_SPEED;
    const eps = Config.COLLISION_EPSILON;

    // Apply gravity
    body.vy = Math.max((body.vy || 0) - gravity * dt, -maxFall);
    body.vx = body.vx || 0;
    body.vz = body.vz || 0;

    const width = body.width;
    const height = body.height;
    const depth = body.depth !== undefined ? body.depth : body.width;
    const halfWidth = width / 2;
    const halfDepth = depth / 2;

    let currX = body.x;
    let currY = body.y;
    let currZ = body.z;

    let hitWallX = false;
    let hitWallZ = false;
    let onGround = false;
    let landedOn = null;
    let hitHead = null;
    const wallRefs = [];

    // Broad-phase bounds along X over the whole step
    const maxDeltaX = Math.abs(body.vx) * dt + 1.0;
    const broadMinX = currX - halfWidth - maxDeltaX;
    const broadMaxX = currX + halfWidth + maxDeltaX;

    // --- 1. MOVE X AND RESOLVE ---
    if (body.vx !== 0) {
      const targetX = currX + body.vx * dt;
      let closestX = targetX;

      for (let index = 0; index < colliders.length; index++) {
        const collider = colliders[index];
        const aabb = collider.aabb;
        if (aabb.maxX < broadMinX || aabb.minX > broadMaxX) {
          continue;
        }

        // Check if overlapping before X move
        const priorOverlapY = Math.min(currY + height, aabb.maxY) - Math.max(currY, aabb.minY) > eps;
        const priorOverlapZ = Math.min(currZ + halfDepth, aabb.maxZ) - Math.max(currZ - halfDepth, aabb.minZ) > eps;
        if (!priorOverlapY || !priorOverlapZ) {
          continue;
        }

        const priorOverlapX = Math.min(currX + halfWidth, aabb.maxX) - Math.max(currX - halfWidth, aabb.minX) > eps;
        if (priorOverlapX) {
          continue; // Was already overlapping before X move
        }

        if (body.vx > 0) {
          if (currX + halfWidth <= aabb.minX + eps && targetX + halfWidth > aabb.minX) {
            const pushX = aabb.minX - eps - halfWidth;
            if (pushX < closestX) {
              closestX = pushX;
            }
          }
        } else {
          if (currX - halfWidth >= aabb.maxX - eps && targetX - halfWidth < aabb.maxX) {
            const pushX = aabb.maxX + eps + halfWidth;
            if (pushX > closestX) {
              closestX = pushX;
            }
          }
        }
      }

      if (body.vx > 0 && closestX < targetX) {
        currX = closestX;
        body.vx = 0;
        hitWallX = true;
      } else if (body.vx < 0 && closestX > targetX) {
        currX = closestX;
        body.vx = 0;
        hitWallX = true;
      } else {
        currX = targetX;
      }

      if (hitWallX) {
        for (let index = 0; index < colliders.length; index++) {
          const collider = colliders[index];
          const aabb = collider.aabb;
          const touchY = Math.min(currY + height, aabb.maxY) - Math.max(currY, aabb.minY) > eps;
          const touchZ = Math.min(currZ + halfDepth, aabb.maxZ) - Math.max(currZ - halfDepth, aabb.minZ) > eps;
          if (touchY && touchZ) {
            const touchRight = Math.abs(currX + halfWidth - (aabb.minX - eps)) < eps * 3;
            const touchLeft = Math.abs(currX - halfWidth - (aabb.maxX + eps)) < eps * 3;
            if (touchRight || touchLeft) {
              if (wallRefs.indexOf(collider.ref) === -1) {
                wallRefs.push(collider.ref);
              }
            }
          }
        }
      }
    }
    body.x = currX;

    // --- 2. MOVE Z AND RESOLVE ---
    if (body.vz !== 0) {
      const targetZ = currZ + body.vz * dt;
      let closestZ = targetZ;

      for (let index = 0; index < colliders.length; index++) {
        const collider = colliders[index];
        const aabb = collider.aabb;
        if (aabb.maxX < broadMinX || aabb.minX > broadMaxX) {
          continue;
        }

        const priorOverlapX = Math.min(currX + halfWidth, aabb.maxX) - Math.max(currX - halfWidth, aabb.minX) > eps;
        const priorOverlapY = Math.min(currY + height, aabb.maxY) - Math.max(currY, aabb.minY) > eps;
        if (!priorOverlapX || !priorOverlapY) {
          continue;
        }

        const priorOverlapZ = Math.min(currZ + halfDepth, aabb.maxZ) - Math.max(currZ - halfDepth, aabb.minZ) > eps;
        if (priorOverlapZ) {
          continue;
        }

        if (body.vz > 0) {
          if (currZ + halfDepth <= aabb.minZ + eps && targetZ + halfDepth > aabb.minZ) {
            const pushZ = aabb.minZ - eps - halfDepth;
            if (pushZ < closestZ) {
              closestZ = pushZ;
            }
          }
        } else {
          if (currZ - halfDepth >= aabb.maxZ - eps && targetZ - halfDepth < aabb.maxZ) {
            const pushZ = aabb.maxZ + eps + halfDepth;
            if (pushZ > closestZ) {
              closestZ = pushZ;
            }
          }
        }
      }

      if (body.vz > 0 && closestZ < targetZ) {
        currZ = closestZ;
        body.vz = 0;
        hitWallZ = true;
      } else if (body.vz < 0 && closestZ > targetZ) {
        currZ = closestZ;
        body.vz = 0;
        hitWallZ = true;
      } else {
        currZ = targetZ;
      }

      if (hitWallZ) {
        for (let index = 0; index < colliders.length; index++) {
          const collider = colliders[index];
          const aabb = collider.aabb;
          const touchX = Math.min(currX + halfWidth, aabb.maxX) - Math.max(currX - halfWidth, aabb.minX) > eps;
          const touchY = Math.min(currY + height, aabb.maxY) - Math.max(currY, aabb.minY) > eps;
          if (touchX && touchY) {
            const touchFront = Math.abs(currZ + halfDepth - (aabb.minZ - eps)) < eps * 3;
            const touchBack = Math.abs(currZ - halfDepth - (aabb.maxZ + eps)) < eps * 3;
            if (touchFront || touchBack) {
              if (wallRefs.indexOf(collider.ref) === -1) {
                wallRefs.push(collider.ref);
              }
            }
          }
        }
      }
    }
    body.z = currZ;

    // --- 3. MOVE Y AND RESOLVE ---
    const targetY = currY + body.vy * dt;
    let resolvedY = targetY;

    if (body.vy < 0) {
      let highestFloorY = targetY;
      for (let index = 0; index < colliders.length; index++) {
        const collider = colliders[index];
        const aabb = collider.aabb;
        if (aabb.maxX < broadMinX || aabb.minX > broadMaxX) {
          continue;
        }

        const overlapX = Math.min(currX + halfWidth, aabb.maxX) - Math.max(currX - halfWidth, aabb.minX) > eps;
        const overlapZ = Math.min(currZ + halfDepth, aabb.maxZ) - Math.max(currZ - halfDepth, aabb.minZ) > eps;
        if (!overlapX || !overlapZ) {
          continue;
        }

        const priorOverlapY = Math.min(currY + height, aabb.maxY) - Math.max(currY, aabb.minY) > eps;
        if (priorOverlapY) {
          continue;
        }

        if (currY >= aabb.maxY - eps && targetY < aabb.maxY) {
          const pushY = aabb.maxY + eps;
          if (pushY > highestFloorY) {
            highestFloorY = pushY;
          }
        }
      }

      if (highestFloorY > targetY) {
        resolvedY = highestFloorY;
        body.vy = 0;
        onGround = true;

        let maxLandedArea = -1;
        for (let index = 0; index < colliders.length; index++) {
          const collider = colliders[index];
          const aabb = collider.aabb;
          if (Math.abs(resolvedY - (aabb.maxY + eps)) < eps * 3) {
            const ox = Math.max(0, Math.min(currX + halfWidth, aabb.maxX) - Math.max(currX - halfWidth, aabb.minX));
            const oz = Math.max(0, Math.min(currZ + halfDepth, aabb.maxZ) - Math.max(currZ - halfDepth, aabb.minZ));
            const area = ox * oz;
            if (area > maxLandedArea) {
              maxLandedArea = area;
              landedOn = collider.ref;
            }
          }
        }
      }
    } else if (body.vy > 0) {
      let lowestCeilingY = targetY;
      for (let index = 0; index < colliders.length; index++) {
        const collider = colliders[index];
        const aabb = collider.aabb;
        if (aabb.maxX < broadMinX || aabb.minX > broadMaxX) {
          continue;
        }

        const overlapX = Math.min(currX + halfWidth, aabb.maxX) - Math.max(currX - halfWidth, aabb.minX) > eps;
        const overlapZ = Math.min(currZ + halfDepth, aabb.maxZ) - Math.max(currZ - halfDepth, aabb.minZ) > eps;
        if (!overlapX || !overlapZ) {
          continue;
        }

        const priorOverlapY = Math.min(currY + height, aabb.maxY) - Math.max(currY, aabb.minY) > eps;
        if (priorOverlapY) {
          continue;
        }

        if (currY + height <= aabb.minY + eps && targetY + height > aabb.minY) {
          const pushY = aabb.minY - eps - height;
          if (pushY < lowestCeilingY) {
            lowestCeilingY = pushY;
          }
        }
      }

      if (lowestCeilingY < targetY) {
        resolvedY = lowestCeilingY;
        body.vy = 0;

        let maxHeadArea = -1;
        for (let index = 0; index < colliders.length; index++) {
          const collider = colliders[index];
          const aabb = collider.aabb;
          if (Math.abs(resolvedY + height - (aabb.minY - eps)) < eps * 3) {
            const ox = Math.max(0, Math.min(currX + halfWidth, aabb.maxX) - Math.max(currX - halfWidth, aabb.minX));
            const oz = Math.max(0, Math.min(currZ + halfDepth, aabb.maxZ) - Math.max(currZ - halfDepth, aabb.minZ));
            const area = ox * oz;
            if (area > maxHeadArea) {
              maxHeadArea = area;
              hitHead = collider.ref;
            }
          }
        }
      }
    }

    body.y = resolvedY;
    body.onGround = onGround;

    return {
      onGround: onGround,
      landedOn: landedOn,
      hitHead: hitHead,
      hitWallX: hitWallX,
      hitWallZ: hitWallZ,
      wallRefs: wallRefs,
    };
  }

  /**
   * Updates player velocity and timers based on player input before stepBody.
   * Handles run acceleration, deceleration, coyote timing, jump buffering,
   * variable height jump cuts, and run-speed jump bonuses.
   * @param {!Object} player Player state object.
   * @param {!Object} input Input state {moveX, moveZ, run, jumpPressed, jumpHeld}.
   * @param {number} dt Timestep in seconds.
   * @return {!{jumped: boolean, jumpVelocity: number}}
   */
  function updatePlayerMotion(player, input, dt) {
    const Config = KUDLA.Config;

    let vx = player.vx || 0;
    let vz = player.vz || 0;
    const moveX = input.moveX || 0;
    const moveZ = input.moveZ || 0;
    const moveLen = Math.hypot(moveX, moveZ);

    const targetSpeed = input.run ? Config.RUN_SPEED : Config.WALK_SPEED;

    if (moveLen > 0.0001) {
      const normalizedMoveX = moveLen > 1 ? moveX / moveLen : moveX;
      const normalizedMoveZ = moveLen > 1 ? moveZ / moveLen : moveZ;
      const targetVx = normalizedMoveX * targetSpeed;
      const targetVz = normalizedMoveZ * targetSpeed;
      const accelRate = player.onGround ? Config.GROUND_ACCEL : Config.AIR_ACCEL;

      const dvx = targetVx - vx;
      const dvz = targetVz - vz;
      const diff = Math.hypot(dvx, dvz);
      const maxChange = accelRate * dt;

      if (diff <= maxChange) {
        vx = targetVx;
        vz = targetVz;
      } else {
        vx += (dvx / diff) * maxChange;
        vz += (dvz / diff) * maxChange;
      }
    } else {
      const decelRate = player.onGround ? Config.GROUND_DECEL : Config.AIR_DECEL;
      const currentSpeed = Math.hypot(vx, vz);
      const decelAmount = decelRate * dt;

      if (currentSpeed <= decelAmount) {
        vx = 0;
        vz = 0;
      } else {
        vx -= (vx / currentSpeed) * decelAmount;
        vz -= (vz / currentSpeed) * decelAmount;
      }
    }

    player.vx = vx;
    player.vz = vz;

    // Coyote timer
    if (player.onGround) {
      player.coyoteTimer = Config.COYOTE_TIME;
      player.jumping = false;
      player.jumpCutUsed = false;
    } else {
      player.coyoteTimer = Math.max(0, (player.coyoteTimer || 0) - dt);
    }

    // Jump buffer timer
    if (input.jumpPressed) {
      player.jumpBufferTimer = Config.JUMP_BUFFER_TIME;
    } else {
      player.jumpBufferTimer = Math.max(0, (player.jumpBufferTimer || 0) - dt);
    }

    let jumped = false;
    let jumpVelocity = 0;

    // Trigger jump
    if (player.coyoteTimer > 0 && player.jumpBufferTimer > 0) {
      const horizontalSpeed = Math.hypot(player.vx || 0, player.vz || 0);
      jumpVelocity = horizontalSpeed > Config.RUN_JUMP_SPEED_THRESHOLD
        ? Config.RUN_JUMP_VELOCITY
        : Config.JUMP_VELOCITY;
      player.vy = jumpVelocity;
      player.coyoteTimer = 0;
      player.jumpBufferTimer = 0;
      player.jumping = true;
      player.jumpCutUsed = false;
      player.onGround = false;
      jumped = true;
    }

    // Variable jump height cut
    if (player.jumping && !input.jumpHeld && player.vy > 0 && !player.jumpCutUsed) {
      player.vy *= Config.JUMP_CUT_MULTIPLIER;
      player.jumpCutUsed = true;
    }

    return {
      jumped: jumped,
      jumpVelocity: jumpVelocity,
    };
  }

  /**
   * Classifies contact with an enemy as stomp, hurt, or null.
   * @param {number} prevBottomY Bottom Y coordinate of the player before the step.
   * @param {!Object} body Player dynamic body.
   * @param {!Object} enemyAABB Enemy axis-aligned bounding box.
   * @return {?string} 'stomp', 'hurt', or null.
   */
  function classifyEnemyContact(prevBottomY, body, enemyAABB) {
    const box = bodyAABB(body);
    if (!intersects(box, enemyAABB)) {
      return null;
    }
    const Config = KUDLA.Config;
    if (body.vy < 0 && prevBottomY >= enemyAABB.maxY - Config.STOMP_TOLERANCE) {
      return 'stomp';
    }
    return 'hurt';
  }

  /**
   * Advances a walking enemy along X, reversing direction upon hitting a wall.
   * @param {!Object} entity Walking entity with {x, y, z, vx, vy, vz, dir, speed, ...}.
   * @param {number} dt Timestep in seconds.
   * @param {!Array<{aabb: Object, ref: Object}>} colliders Array of colliders.
   * @return {!Object} Result of stepBody.
   */
  function stepWalker(entity, dt, colliders) {
    const Config = KUDLA.Config;
    const speed = entity.speed !== undefined ? entity.speed : Config.CRAB_SPEED;
    entity.vx = entity.dir * speed;
    entity.vz = 0;
    const result = stepBody(entity, dt, colliders);
    if (result.hitWallX) {
      entity.dir = -entity.dir;
    }
    return result;
  }

  /**
   * Advances a fireball projectile, bouncing on floor landings and dying on walls.
   * @param {!Object} fireball Fireball entity with {x, y, z, vx, vy, vz, alive, ...}.
   * @param {number} dt Timestep in seconds.
   * @param {!Array<{aabb: Object, ref: Object}>} colliders Array of colliders.
   * @return {!{alive: boolean, bounced: boolean, hitWall: boolean}}
   */
  function stepFireball(fireball, dt, colliders) {
    const Config = KUDLA.Config;
    if (fireball.alive === undefined) {
      fireball.alive = true;
    }
    const result = stepBody(fireball, dt, colliders);
    let bounced = false;
    let hitWall = false;

    if (result.onGround) {
      fireball.vy = Config.FIREBALL_BOUNCE_VELOCITY;
      bounced = true;
    }
    if (result.hitWallX || result.hitWallZ) {
      fireball.alive = false;
      hitWall = true;
    }

    return {
      alive: fireball.alive,
      bounced: bounced,
      hitWall: hitWall,
    };
  }

  const Physics = {
    makeAABB: makeAABB,
    boxToAABB: boxToAABB,
    bodyAABB: bodyAABB,
    intersects: intersects,
    stepBody: stepBody,
    updatePlayerMotion: updatePlayerMotion,
    classifyEnemyContact: classifyEnemyContact,
    stepWalker: stepWalker,
    stepFireball: stepFireball,
  };

  KUDLA.Physics = Physics;
  if (typeof module === 'object' && module.exports) {
    module.exports = Physics;
  }
})(typeof window !== 'undefined' ? window : globalThis);
