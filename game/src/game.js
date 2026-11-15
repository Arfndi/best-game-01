// Ember Orbit — the game itself: state machine, input, scoring.
// Screens: title → play (aim → fly → resolve) → level-complete / game-over → next
// level or title; finish all ten and the victory screen closes the run. The flight is
// simulated by physics.js at a fixed step, so what the player sees is exactly what the
// preview promised. Best score persists in localStorage; nothing else leaves the page.

import {
  EMBER_RADIUS, FIELD_HEIGHT, FIELD_WIDTH, LEVELS, SHARD_RADIUS,
} from './levels.js';
import {
  MAX_LAUNCH_SPEED, MIN_LAUNCH_SPEED, STEP, previewPath, simulateLaunch,
} from './physics.js';
import { Renderer } from './render.js';
import { SoundFX } from './audio.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_COMPLETE = 'complete';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const BEST_KEY = 'ember-orbit-best';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.sfx = new SoundFX();
    this.levelIndex = 0;
    this.score = 0;
    this.best = 0;
    try {
      this.best = Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
    } catch {
      this.best = 0;
    }
    this.screen = SCREEN_TITLE;
    this.time = 0;
    this.aiming = false;
    this.aim = { x: 0, y: 0 };
    this.flight = null;
    this.trail = [];
    this.combo = 1;
    this.comboTimer = 0;
    this.message = '';
    this.messageTimer = 0;
    this.stars = 0;
    this.loadLevel(0);
    // The run opens on the title screen, not mid-level: loadLevel leaves the game
    // in play, so step back to the title here. The first click starts level 1.
    this.screen = SCREEN_TITLE;
  }

  get level() {
    return LEVELS[this.levelIndex];
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.collected = new Set();
    this.launchesLeft = this.level.launches;
    this.flight = null;
    this.trail = [];
    this.combo = 1;
    this.comboTimer = 0;
    this.stars = 0;
    this.screen = SCREEN_PLAY;
    this.renderer.buildBackdrop(this.level.name, 1);
  }

  saveBest() {
    if (this.score <= this.best) return;
    this.best = this.score;
    try {
      window.localStorage.setItem(BEST_KEY, String(this.best));
    } catch {
      // Storage may be unavailable; the score still counts for this run.
    }
  }

  /** Where the ember sits right now: the launch pad, or mid-flight. */
  emberPos() {
    if (this.flight) return { x: this.flight.x, y: this.flight.y };
    return { x: this.level.start.x, y: this.level.start.y };
  }

  /** Canvas coordinates of a pointer event, in playfield space. */
  toField(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * this.canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * this.canvas.height,
    };
  }

  onPointerDown(event) {
    this.sfx.unlock();
    const p = this.toField(event);
    if (this.screen === SCREEN_TITLE) {
      this.sfx.click();
      this.loadLevel(0);
      this.score = 0;
      return;
    }
    if (this.screen === SCREEN_COMPLETE) {
      this.sfx.click();
      if (this.levelIndex + 1 >= LEVELS.length) {
        this.screen = SCREEN_VICTORY;
      } else {
        this.loadLevel(this.levelIndex + 1);
      }
      return;
    }
    if (this.screen === SCREEN_OVER) {
      this.sfx.click();
      this.score = 0;
      this.loadLevel(0);
      return;
    }
    if (this.screen === SCREEN_VICTORY) {
      this.sfx.click();
      this.score = 0;
      this.loadLevel(0);
      return;
    }
    if (this.screen !== SCREEN_PLAY) return;
    if (this.flight) {
      // A click mid-flight ends the flight early: the ember fizzles where it is and
      // whatever shards it already banked stay banked. Long orbits never trap the player.
      this.endFlightEarly();
      return;
    }
    this.aiming = true;
    this.aim = p;
  }

  /** Cut a flight short at the ember's current position, keeping shards already won. */
  endFlightEarly() {
    if (!this.flight) return;
    const f = this.flight;
    f.ended = true;
    this.flight = null;
    this.trail = [];
    this.resolveFlight({ ...f.result, end: 'timeout', endAt: f.t });
  }

  onPointerMove(event) {
    if (!this.aiming) return;
    this.aim = this.toField(event);
  }

  onPointerUp() {
    if (!this.aiming) return;
    this.aiming = false;
    if (this.screen !== SCREEN_PLAY || this.flight) return;
    const start = this.level.start;
    let dx = start.x - this.aim.x;
    let dy = start.y - this.aim.y;
    const len = Math.hypot(dx, dy);
    if (len < 12) return;
    const speed = Math.min(MAX_LAUNCH_SPEED, Math.max(MIN_LAUNCH_SPEED, len * 2.4));
    dx /= len;
    dy /= len;
    this.launch(Math.atan2(dy, dx), speed);
  }

  onKey(event) {
    if (event.key === 'm' || event.key === 'M') {
      this.sfx.setMuted(!this.sfx.muted);
      return;
    }
    if (event.key === 'r' || event.key === 'R') {
      if (this.screen === SCREEN_PLAY) {
        this.loadLevel(this.levelIndex);
        this.message = 'LEVEL RESTARTED';
        this.messageTimer = 1.5;
      }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      if (this.screen === SCREEN_TITLE) {
        this.sfx.unlock();
        this.sfx.click();
        this.score = 0;
        this.loadLevel(0);
      } else if (this.screen === SCREEN_COMPLETE) {
        this.sfx.click();
        if (this.levelIndex + 1 >= LEVELS.length) this.screen = SCREEN_VICTORY;
        else this.loadLevel(this.levelIndex + 1);
      } else if (this.screen === SCREEN_OVER || this.screen === SCREEN_VICTORY) {
        this.sfx.click();
        this.score = 0;
        this.loadLevel(0);
      }
    }
  }

  /** Start a flight: simulate it fully up front, then play it back in real time. */
  launch(angle, speed) {
    if (this.launchesLeft <= 0) return;
    this.launchesLeft -= 1;
    this.sfx.launch();
    const result = simulateLaunch(this.level, angle, speed, this.collected);
    this.flight = {
      x: this.level.start.x,
      y: this.level.start.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      t: 0,
      step: 0,
      result,
      gained: [],
      gainIndex: 0,
      ended: false,
    };
    this.trail = [{ x: this.level.start.x, y: this.level.start.y }];
  }

  /** Advance one frame: flight playback, combo decay, message timers. */
  update(dt) {
    this.time += dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (!this.flight || this.flight.ended) return;
    const f = this.flight;
    // Play the pre-simulated flight back at the fixed step, collecting shards as the
    // ember passes them and banking the score live.
    const steps = Math.max(1, Math.round(dt / STEP));
    for (let i = 0; i < steps && !f.ended; i += 1) {
      f.t += STEP;
      f.step += 1;
      // Re-integrate from the stored path instead of re-running physics: the path is
      // sampled every 3rd step, so interpolate between samples for smoothness.
      const sampleAt = f.t / (STEP * 3);
      const idx = Math.min(Math.floor(sampleAt), f.result.path.length - 2);
      const frac = Math.min(1, sampleAt - idx);
      const p0 = f.result.path[Math.max(0, idx)];
      const p1 = f.result.path[Math.min(f.result.path.length - 1, idx + 1)];
      f.x = p0.x + (p1.x - p0.x) * frac;
      f.y = p0.y + (p1.y - p0.y) * frac;
      this.trail.push({ x: f.x, y: f.y });
      if (this.trail.length > 90) this.trail.shift();
      // Shard pickups happen exactly when the simulated flight won them: each gain
      // was recorded with its physics step, so the chime lands as the ember arrives.
      while (f.gainIndex < f.result.gained.length && f.result.gainStep[f.gainIndex] <= f.step) {
        const shardIndex = f.result.gained[f.gainIndex];
        f.gainIndex += 1;
        this.collected.add(shardIndex);
        const gained = 100 * this.combo;
        this.score += gained;
        this.combo = Math.min(6, this.combo + 1);
        this.comboTimer = 2.5;
        this.sfx.shard(this.combo);
      }
      if (f.t >= f.result.endAt) f.ended = true;
    }
    if (f.ended) this.resolveFlight(f.result);
  }

  resolveFlight(result) {
    this.flight = null;
    this.trail = [];
    if (result.end === 'done' || this.collected.size >= this.level.shards.length) {
      const bonus = 250 * this.launchesLeft + 500;
      this.score += bonus;
      const used = this.level.launches - this.launchesLeft;
      this.stars = used <= this.level.par ? 3 : used <= this.level.par + 1 ? 2 : 1;
      this.saveBest();
      this.sfx.win();
      this.screen = this.levelIndex + 1 >= LEVELS.length ? SCREEN_VICTORY : SCREEN_COMPLETE;
      return;
    }
    if (result.end === 'crash') {
      this.sfx.crash();
      this.message = 'CRASHED INTO A PLANET';
      this.messageTimer = 2;
    } else if (result.end === 'lost') {
      this.message = 'LOST TO DEEP SPACE';
      this.messageTimer = 2;
    } else if (result.end === 'caught') {
      this.sfx.crash();
      this.message = 'CAUGHT BY GRAVITY';
      this.messageTimer = 2;
    }
    if (this.launchesLeft <= 0) {
      this.saveBest();
      this.sfx.lose();
      this.screen = SCREEN_OVER;
    }
  }

  draw() {
    const r = this.renderer;
    r.drawBackdrop(this.time);
    const level = this.level;
    for (const planet of level.planets) r.drawPlanet(planet, this.flight ? this.flight.t : this.time, this.time);
    level.shards.forEach((shard, i) => r.drawShard(shard, this.time, this.collected.has(i)));
    const pos = this.emberPos();
    if (this.screen === SCREEN_PLAY || this.screen === SCREEN_COMPLETE || this.screen === SCREEN_OVER) {
      r.drawEmber(pos.x, pos.y, this.trail, this.time);
    }
    if (this.aiming && !this.flight && this.screen === SCREEN_PLAY) {
      const start = level.start;
      const dx = start.x - this.aim.x;
      const dy = start.y - this.aim.y;
      const len = Math.hypot(dx, dy);
      if (len >= 12) {
        const speed = Math.min(MAX_LAUNCH_SPEED, Math.max(MIN_LAUNCH_SPEED, len * 2.4));
        const angle = Math.atan2(dy, dx);
        r.drawAim(start, angle, speed, previewPath(level, angle, speed));
      }
    }
    if (this.screen !== SCREEN_TITLE) r.drawHud(this);
    if (this.flight && this.screen === SCREEN_PLAY) {
      const c = r.ctx;
      c.textAlign = 'center';
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.font = '15px system-ui, sans-serif';
      c.fillText('CLICK TO END THE FLIGHT EARLY', FIELD_WIDTH / 2, FIELD_HEIGHT - 70);
    }
    if (this.messageTimer > 0) {
      const c = r.ctx;
      c.textAlign = 'center';
      c.globalAlpha = Math.min(1, this.messageTimer);
      c.fillStyle = '#ff9a7a';
      c.font = '700 30px system-ui, sans-serif';
      c.fillText(this.message, FIELD_WIDTH / 2, 150);
      c.globalAlpha = 1;
    }
    if (this.screen === SCREEN_TITLE) {
      r.drawTitle(this.best);
    } else if (this.screen === SCREEN_COMPLETE) {
      const used = this.level.launches - this.launchesLeft;
      r.drawPanel('SYSTEM LIT', [
        `${'★'.repeat(this.stars)}${'☆'.repeat(3 - this.stars)}   ${used} launch${used === 1 ? '' : 'es'} used`,
        `Score ${this.score}   ·   Best ${this.best}`,
        'CLICK OR PRESS ENTER FOR THE NEXT SYSTEM',
      ], '#ffe27a');
    } else if (this.screen === SCREEN_OVER) {
      r.drawPanel('THE EMBER FADES', [
        `You lit ${this.collected.size} of ${this.level.shards.length} shards in ${this.level.name}.`,
        `Score ${this.score}   ·   Best ${this.best}`,
        'CLICK OR PRESS ENTER TO TRY AGAIN',
      ], '#ff8a7a');
    } else if (this.screen === SCREEN_VICTORY) {
      r.drawPanel('ALL TEN SYSTEMS LIT', [
        'The last ember became a sunrise. You lit every shard in the sky.',
        `Final score ${this.score}   ·   Best ${this.best}`,
        'CLICK OR PRESS ENTER TO PLAY AGAIN',
      ], '#ffe27a');
    }
  }
}
