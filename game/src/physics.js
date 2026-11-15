// Fixed-step gravity flight for Ember Orbit, plus the autopilot that proves every
// level is winnable. The simulation is pure and deterministic: same level, same
// launch angle and speed, same flight — no time, no Math.random anywhere here.
// Planets pull with mu / r^2 (softened near the surface so the integrator stays
// stable); black holes pull harder and swallow anything that touches them.
import { FIELD_WIDTH, FIELD_HEIGHT } from './levels.js';

export const EMBER_R = 7;
export const SHARD_R = 15;
export const STEP = 1 / 120;
export const MAX_FLIGHT = 40;
export const MAX_LAUNCH_SPEED = 640;
export const DRAG_SCALE = 3.2;
export const OOB_MARGIN = 70;

// One gravity source: a planet or a black hole.
function accelAt(x, y, body) {
  const dx = body.x - x;
  const dy = body.y - y;
  const d2 = dx * dx + dy * dy;
  // Soften inside 60% of the body radius: avoids a numerical spike on a close pass.
  const eps = body.r * 0.6;
  const soft = d2 + eps * eps;
  const inv = body.mu / (soft * Math.sqrt(soft));
  return [dx * inv, dy * inv];
}

// Advance one fixed step. Mutates `s` and returns 'crash' | 'swallow' | 'drift' | null.
export function stepFlight(s, level) {
  const bodies = level.planets.concat(level.blackHoles);
  let ax = 0;
  let ay = 0;
  for (let i = 0; i < bodies.length; i += 1) {
    const a = accelAt(s.x, s.y, bodies[i]);
    ax += a[0];
    ay += a[1];
  }
  s.vx += ax * STEP;
  s.vy += ay * STEP;
  s.x += s.vx * STEP;
  s.y += s.vy * STEP;
  s.time += STEP;
  if (s.trail.length === 0 || s.time - s.trailAt >= 1 / 30) {
    s.trail.push({ x: s.x, y: s.y });
    s.trailAt = s.time;
    if (s.trail.length > 900) s.trail.shift();
  }
  for (let i = 0; i < level.planets.length; i += 1) {
    const p = level.planets[i];
    const dx = s.x - p.x;
    const dy = s.y - p.y;
    if (dx * dx + dy * dy < (p.r + EMBER_R) * (p.r + EMBER_R)) return 'crash';
  }
  for (let i = 0; i < level.blackHoles.length; i += 1) {
    const b = level.blackHoles[i];
    const dx = s.x - b.x;
    const dy = s.y - b.y;
    if (dx * dx + dy * dy < (b.r + EMBER_R) * (b.r + EMBER_R)) return 'swallow';
  }
  if (
    s.x < -OOB_MARGIN ||
    s.x > FIELD_WIDTH + OOB_MARGIN ||
    s.y < -OOB_MARGIN ||
    s.y > FIELD_HEIGHT + OOB_MARGIN
  ) {
    return 'drift';
  }
  const speed2 = s.vx * s.vx + s.vy * s.vy;
  if (speed2 < 64) {
    s.slow += STEP;
    if (s.slow > 1.5) return 'drift';
  } else {
    s.slow = 0;
  }
  return null;
}

// Fly one launch from the ember start. `collected` is a Set of shard indexes already
// banked. Returns the shards this flight collected, how it ended, and the trail.
export function simulateLaunch(level, angle, speed, collected, maxTime) {
  const s = {
    x: level.ember.x,
    y: level.ember.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    time: 0,
    slow: 0,
    trail: [{ x: level.ember.x, y: level.ember.y }],
    trailAt: 0,
  };
  const got = [];
  const limit = maxTime === undefined ? MAX_FLIGHT : maxTime;
  let end = 'timeout';
  while (s.time < limit) {
    const hit = stepFlight(s, level);
    for (let i = 0; i < level.shards.length; i += 1) {
      if (collected.has(i) || got.indexOf(i) !== -1) continue;
      const sh = level.shards[i];
      const dx = s.x - sh.x;
      const dy = s.y - sh.y;
      if (dx * dx + dy * dy < (SHARD_R + EMBER_R) * (SHARD_R + EMBER_R)) got.push(i);
    }
    if (hit !== null) {
      end = hit;
      break;
    }
  }
  return { got, end, trail: s.trail, time: s.time, endX: s.x, endY: s.y };
}

// Distance from a point to the nearest uncollected shard (for scoring candidates).
function nearestShardGap(level, collected, x, y) {
  let best = Infinity;
  for (let i = 0; i < level.shards.length; i += 1) {
    if (collected.has(i)) continue;
    const sh = level.shards[i];
    const dx = sh.x - x;
    const dy = sh.y - y;
    const d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return best === Infinity ? 0 : Math.sqrt(best);
}

// Score one candidate launch: shards first, then a safe ending, then closeness to
// the nearest shard still uncollected (so a flight that sets up the next launch wins).
function scoreLaunch(level, collected, angle, speed) {
  const r = simulateLaunch(level, angle, speed, collected);
  let score = r.got.length * 1000;
  if (r.end === 'crash' || r.end === 'swallow') score -= 300;
  if (r.end === 'drift') score -= 200;
  if (r.end === 'timeout') score -= 50;
  score -= nearestShardGap(level, new Set([...collected, ...r.got]), r.endX, r.endY) * 0.4;
  score += Math.min(r.time, 10) * 2;
  return { angle, speed, score, got: r.got, end: r.end, trail: r.trail, time: r.time };
}

// Grid-search the launch that collects the most shards from the current state.
// `coarse` uses a wide grid (fast, for live staging); the test harness uses fine.
// After the grid, the best few candidates are refined locally (1-degree / 5-speed
// steps), because a two-shard slingshot often hides in a narrow window the grid
// steps over.
export function findBestLaunch(level, collected, coarse) {
  const angleStep = coarse ? Math.PI / 30 : Math.PI / 45;
  const speedStep = coarse ? 30 : 20;
  const speedMin = coarse ? 140 : 120;
  const refineAngle = Math.PI / 180;
  const refineSpeed = 5;
  const top = [];
  for (let a = 0; a < Math.PI * 2; a += angleStep) {
    for (let sp = speedMin; sp <= MAX_LAUNCH_SPEED; sp += speedStep) {
      const c = scoreLaunch(level, collected, a, sp);
      top.push(c);
      top.sort((x, y) => y.score - x.score);
      if (top.length > 6) top.length = 6;
    }
  }
  let best = top[0];
  for (const seed of top) {
    for (let da = -angleStep; da <= angleStep; da += refineAngle) {
      for (let ds = -speedStep; ds <= speedStep; ds += refineSpeed) {
        const sp = seed.speed + ds;
        if (sp < 100 || sp > MAX_LAUNCH_SPEED) continue;
        const c = scoreLaunch(level, collected, seed.angle + da, sp);
        if (c.score > best.score) best = c;
      }
    }
  }
  // Last resort: when the grid finds nothing, a shard can hide in a window
  // narrower than the grid steps. Scan densely (2 degrees, 10 speed) so a
  // stranded final shard is always found instead of giving up the level.
  if (best.got.length === 0) {
    for (let aDeg = 0; aDeg < 360; aDeg += 2) {
      const a = (aDeg * Math.PI) / 180;
      for (let sp = 100; sp <= MAX_LAUNCH_SPEED; sp += 10) {
        const c = scoreLaunch(level, collected, a, sp);
        if (c.score > best.score) best = c;
      }
    }
  }
  return best;
}

// Play a whole level with the autopilot: launch, bank what it collects, repeat.
// Returns whether the level completes, how many launches it took, and per-launch detail.
export function autopilotLevel(level, coarse) {
  const collected = new Set();
  const launches = [];
  while (collected.size < level.shards.length && launches.length < level.launches) {
    const best = findBestLaunch(level, collected, coarse);
    if (best === null || best.got.length === 0) break;
    for (const i of best.got) collected.add(i);
    launches.push({ angle: best.angle, speed: best.speed, got: best.got, end: best.end, time: best.time });
  }
  return {
    complete: collected.size === level.shards.length,
    collected: collected.size,
    total: level.shards.length,
    launchesUsed: launches.length,
    launches,
  };
}

// Sample a trajectory preview for the aim UI: points until crash, drift or cap.
export function previewPath(level, angle, speed) {
  const r = simulateLaunch(level, angle, speed, new Set(), 12);
  const pts = [];
  for (let i = 0; i < r.trail.length; i += 2) pts.push(r.trail[i]);
  return { points: pts, end: r.end };
}
