// Ember Orbit — deterministic screenshot scenes behind ?shot=start|play|end.
// Each scene plays the real game forward from a fresh level for a fixed amount of
// time, steered by the autopilot (physics.findLaunch), so the frame is what a short
// game really looks like — and the same seed always gives the same frame. The play
// scene's pilot takes the best launch it can find; the end scene's pilot plays the
// whole level to its conclusion, so it lands on the level-complete screen when the
// level is winnable and on the game-over screen when it is not.

import { SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './game.js';
import { findLaunch } from './physics.js';

/** Advance a game through one flight without rendering, applying its outcome. */
function playFlight(game, launch) {
  game.launch(launch.angle, launch.speed);
  const flight = game.flight;
  if (!flight) return;
  // Step the whole flight at the fixed step until it resolves.
  let guard = 0;
  while (game.flight && guard < 20000) {
    game.update(1 / 60);
    guard += 1;
  }
}

/**
 * Set `game` to the named scene (start, play or end; any other name is start) and
 * return the screen the renderer should draw over it.
 */
export function stageShot(name, game) {
  game.loadLevel(0);
  game.score = 0;
  if (name !== 'play' && name !== 'end') {
    // Title screen over a level that has been breathing for a few seconds: the
    // starfield twinkles and the drifting world (level 6+) has moved on.
    for (let i = 0; i < 5 * 60; i += 1) game.update(1 / 60);
    game.screen = SCREEN_TITLE;
    return SCREEN_TITLE;
  }
  if (name === 'play') {
    const launch = findLaunch(game.level, game.collected);
    if (launch) {
      game.launch(launch.angle, launch.speed);
      // Fly part-way into the flight — about halfway, or just under three seconds —
      // so the frame catches the ember mid-arc with its trail behind it, before the
      // flight resolves and the ember resets to the launch pad.
      const target = Math.min(2.8, launch.flight.endAt * 0.45);
      const steps = Math.floor(target * 60);
      for (let i = 0; i < steps; i += 1) {
        if (!game.flight) break;
        game.update(1 / 60);
      }
    }
    game.messageTimer = 0;
    game.screen = SCREEN_PLAY;
    return SCREEN_PLAY;
  }
  // End scene: play the level to its conclusion with the autopilot at the helm.
  let rounds = 0;
  while (game.screen === SCREEN_PLAY && rounds < 12) {
    const launch = findLaunch(game.level, game.collected);
    if (!launch) break;
    playFlight(game, launch);
    rounds += 1;
  }
  // Clear transient banners so the result panel is the shot's clean subject.
  game.messageTimer = 0;
  game.comboTimer = 0;
  if (game.screen === SCREEN_COMPLETE) return SCREEN_COMPLETE;
  if (game.screen === SCREEN_OVER) return SCREEN_OVER;
  game.screen = SCREEN_OVER;
  return SCREEN_OVER;
}
