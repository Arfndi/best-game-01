// Ember Orbit — flight physics and the autopilot.
// The ember is a point with a velocity; every planet pulls it with acceleration
// pull / distance^2 toward the planet's centre. Integration is semi-implicit Euler at a
// fixed 120 Hz step, so a flight is a pure function of (level, launch angle, launch
// speed): the same launch always flies the same path. That is what makes the game fair,
// the trajectory preview honest, and the screenshot autopilot repeatable.

import { EMBER_RADIUS, FIELD_HEIGHT, FIELD_WIDTH, SHARD_RADIUS, planetAt } from './levels.js';

export const STEP = 1 / 120;
export const MAX_FLIGHT_SECONDS = 14;
export const MIN_LAUNCH_SPEED = 140;
export const MAX_LAUNCH_SPEED = 560;
export const OUT_MARGIN = 100;

/** Gravity acceleration at (x, y) at flight-time t, from every planet in the level. */
export function gravityAt(level, x, y, t) {
  let ax = 0;
  let ay = 0;
  for (const planet of level.planets) {
    const p = planetAt(planet, t);
    const dx = p.x - x;
    const dy = p.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 1) continue;
    const d = Math.sqrt(d2);
    const a = planet.pull / d2;
    ax += (a * dx) / d;
    ay += (a * dy) / d;
  }
  return { ax, ay };
}

/** One fixed physics step. Mutates and returns the flight body. */
export function stepBody(level, body, dt) {
  const g = gravityAt(level, body.x, body.y, body.t);
  body.vx += g.ax * dt;
  body.vy += g.ay * dt;
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  body.t += dt;
  return body;
}

/**
 * Simulate one launch to its end. `collected` is a Set of shard indexes already taken
 * (they stay taken and are not re-scored). Returns the flight's outcome:
 *   path      sampled positions, one every 3rd step, for the trail and the preview
 *   gained    indexes of shards this flight collected, in order
 *   gainStep  the physics step at which each gained shard was collected
 *   end       'crash' | 'lost' | 'caught' | 'timeout' | 'done'
 *   endAt     flight-time in seconds when it ended
 *   endPos    where it ended
 * A flight ends on a crash, on leaving the field, on being caught slow by a well, on
 * the timeout — or early, once it has collected every shard that is left.
 */
export function simulateLaunch(level, angle, speed, collected) {
  const body = {
    x: level.start.x,
    y: level.start.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    t: 0,
  };
  const path = [{ x: body.x, y: body.y }];
  const gained = [];
  const gainStep = [];
  const remaining = level.shards.length - collected.size;
  let slowTime = 0;
  let end = 'timeout';
  let steps = 0;
  const maxSteps = Math.floor(MAX_FLIGHT_SECONDS / STEP);
  while (steps < maxSteps) {
    stepBody(level, body, STEP);
    steps += 1;
    if (steps % 3 === 0) path.push({ x: body.x, y: body.y });
    // Shard pickup.
    for (let i = 0; i < level.shards.length; i += 1) {
      if (collected.has(i) || gained.includes(i)) continue;
      const s = level.shards[i];
      const dx = s.x - body.x;
      const dy = s.y - body.y;
      if (dx * dx + dy * dy < (SHARD_RADIUS + EMBER_RADIUS) * (SHARD_RADIUS + EMBER_RADIUS)) {
        gained.push(i);
        gainStep.push(steps);
      }
    }
    if (gained.length >= remaining) {
      end = 'done';
      break;
    }
    // Planet crash (black holes swallow a little wider than their drawn rim).
    let crashed = false;
    for (const planet of level.planets) {
      const p = planetAt(planet, body.t);
      const dx = p.x - body.x;
      const dy = p.y - body.y;
      const hit = planet.blackHole ? planet.r + 14 : planet.r + EMBER_RADIUS - 2;
      if (dx * dx + dy * dy < hit * hit) {
        crashed = true;
        break;
      }
    }
    if (crashed) {
      end = 'crash';
      break;
    }
    // Lost to deep space.
    if (
      body.x < -OUT_MARGIN || body.x > FIELD_WIDTH + OUT_MARGIN ||
      body.y < -OUT_MARGIN || body.y > FIELD_HEIGHT + OUT_MARGIN
    ) {
      end = 'lost';
      break;
    }
    // Caught slow: barely moving near a well for two seconds means it will never escape.
    const v2 = body.vx * body.vx + body.vy * body.vy;
    if (v2 < 20 * 20) {
      slowTime += STEP;
      if (slowTime > 2) {
        end = 'caught';
        break;
      }
    } else {
      slowTime = 0;
    }
  }
  return { path, gained, gainStep, end, endAt: body.t, endPos: { x: body.x, y: body.y } };
}

/** The dotted arc the player sees while aiming: the first 1.6 s of a launch. */
export function previewPath(level, angle, speed) {
  const body = {
    x: level.start.x,
    y: level.start.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    t: 0,
  };
  const points = [{ x: body.x, y: body.y }];
  const steps = Math.floor(1.6 / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepBody(level, body, STEP);
    if (i % 4 === 0) points.push({ x: body.x, y: body.y });
    let hit = false;
    for (const planet of level.planets) {
      const p = planetAt(planet, body.t);
      const dx = p.x - body.x;
      const dy = p.y - body.y;
      if (dx * dx + dy * dy < (planet.r + EMBER_RADIUS) * (planet.r + EMBER_RADIUS)) {
        hit = true;
        break;
      }
    }
    if (hit) break;
  }
  return points;
}

/**
 * The autopilot: search launch angles and speeds for the flight that collects the most
 * of the shards still left, preferring flights that survive (no crash) and end sooner.
 * Used by the screenshot scenes and by nothing in live play — the player aims by hand.
 */
export function findLaunch(level, collected) {
  let best = null;
  let bestScore = -Infinity;
  for (let deg = 0; deg < 360; deg += 4) {
    for (let speed = 200; speed <= MAX_LAUNCH_SPEED; speed += 20) {
      const angle = (deg * Math.PI) / 180;
      const flight = simulateLaunch(level, angle, speed, collected);
      if (flight.gained.length === 0) continue;
      let score = flight.gained.length * 1000;
      if (flight.end === 'done') score += 500;
      if (flight.end === 'crash') score -= 400;
      if (flight.end === 'lost') score -= 200;
      score -= flight.endAt * 4;
      if (score > bestScore) {
        bestScore = score;
        best = { angle, speed, flight };
      }
    }
  }
  return best;
}
