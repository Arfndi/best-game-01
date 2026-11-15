// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh level, steered by the same grid-search autopilot the
// winnability test uses, so every frame is what a real game looks like and the
// same seed always gives the same frame. The play scene freezes a long, safe
// flight mid-arc (never a crash frame); the end scene plays a whole level the
// autopilot finishes inside par, so the panel shows three stars.
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_LEVEL } from './render.js';
import { simulateLaunch, findBestLaunch, autopilotLevel, MAX_LAUNCH_SPEED } from './physics.js';

const START_SECONDS = 4;
const PLAY_FREEZE = 4;
const END_LEVEL_INDEX = 4;

// Score from a list of per-launch shard hauls, with the combo rule the game uses:
// the k-th shard of one flight is worth 100 * k.
function scoreFromHauls(launches, launchesLeft) {
  let score = 0;
  for (const l of launches) {
    for (let k = 1; k <= l.got.length; k += 1) score += 100 * k;
  }
  return score + 250 * launchesLeft;
}

// The nicest mid-flight frame: a launch that collects at least one shard, stays
// airborne for a while, and ends by drifting out (not by crashing into a planet).
function findShowcaseLaunch(level) {
  let best = null;
  for (let aDeg = 0; aDeg < 360; aDeg += 6) {
    const a = (aDeg * Math.PI) / 180;
    for (let sp = 140; sp <= MAX_LAUNCH_SPEED; sp += 30) {
      const r = simulateLaunch(level, a, sp, new Set());
      if (r.got.length < 1 || r.end === 'crash' || r.end === 'swallow') continue;
      if (r.time < 5) continue;
      if (best === null || r.time > best.time) best = { angle: a, speed: sp, result: r };
    }
  }
  return best;
}

// Set `game` to the named scene (start, play or end; any other name is start) and
// return the screen to draw over it.
export function stageShot(name, game) {
  const level = game.level;
  game.loadLevel(game.levelIndex, true);
  if (name !== 'play' && name !== 'end') {
    // Title: let the ember glow on its pad for a few seconds of starfield shimmer.
    game.time = START_SECONDS;
    game.screen = SCREEN_TITLE;
    return { screen: SCREEN_TITLE };
  }
  if (name === 'play') {
    const show = findShowcaseLaunch(level);
    const pick = show !== null ? show : null;
    let flight = null;
    if (pick !== null) {
      flight = simulateLaunch(level, pick.angle, pick.speed, new Set(), PLAY_FREEZE);
    } else {
      const best = findBestLaunch(level, new Set(), true);
      flight = simulateLaunch(level, best.angle, best.speed, new Set(), PLAY_FREEZE);
    }
    game.flight = {
      x: flight.endX,
      y: flight.endY,
      vx: 0,
      vy: 0,
      time: flight.time,
      slow: 0,
      trail: flight.trail,
      trailAt: flight.time,
      got: flight.got,
    };
    // Bank what the frozen flight collected, so the HUD shows real progress.
    for (const i of flight.got) game.collected.add(i);
    game.combo = flight.got.length;
    game.score = flight.got.reduce((sum, _, k) => sum + 100 * (k + 1), 0);
    game.launchesLeft = level.launches - 1;
    game.launchesUsed = 1;
    game.time = PLAY_FREEZE;
    game.screen = SCREEN_PLAY;
    return { screen: SCREEN_PLAY };
  }
  // End: play a whole level the autopilot finishes inside par (Slalom), so the
  // panel shows the three-star finish with a launch bonus.
  game.loadLevel(END_LEVEL_INDEX, true);
  const endLevel = game.level;
  const report = autopilotLevel(endLevel, true);
  if (report.complete) {
    game.launchesLeft = endLevel.launches - report.launchesUsed;
    game.launchesUsed = report.launchesUsed;
    game.collected = new Set(endLevel.shards.map((_, i) => i));
    game.score = scoreFromHauls(report.launches, game.launchesLeft);
    game.starsEarned = game.launchesUsed <= endLevel.par ? 3 : game.launchesUsed <= endLevel.par + 1 ? 2 : 1;
    const stars = '★'.repeat(game.starsEarned) + '☆'.repeat(3 - game.starsEarned);
    game.endLines = [
      `${stars}   ${endLevel.name} lit!`,
      `Launch bonus +${250 * game.launchesLeft}  ·  Score ${game.score}`,
      'Click or press Enter for the next system.',
    ];
    game.screen = SCREEN_LEVEL;
    game.time = 12;
    return { screen: SCREEN_LEVEL };
  }
  game.screen = SCREEN_PLAY;
  return { screen: SCREEN_PLAY };
}
