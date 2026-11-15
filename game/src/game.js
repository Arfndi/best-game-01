// Ember Orbit — state machine, input and scoring. The flight itself lives in
// physics.js; this class owns the screens (title / play / level-end / game-over /
// victory), the drag-to-aim input, launches, combos and the score. A launch costs
// one of the level's launches; banking shards mid-flight keeps what you collected.
import { LEVELS, FIELD_WIDTH, FIELD_HEIGHT } from './levels.js';
import {
  EMBER_R,
  STEP,
  MAX_LAUNCH_SPEED,
  DRAG_SCALE,
  stepFlight,
  previewPath,
} from './physics.js';
import { Renderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_LEVEL, SCREEN_OVER, SCREEN_WIN } from './render.js';
import { Sound } from './audio.js';

const MIN_DRAG = 12;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.sound = new Sound();
    this.levelIndex = 0;
    this.score = 0;
    this.best = 0;
    try {
      this.best = Number(window.localStorage.getItem('ember-orbit-best') || 0) || 0;
    } catch {
      this.best = 0;
    }
    this.screen = SCREEN_TITLE;
    this.time = 0;
    this.loadLevel(0, false);
  }

  get level() {
    return LEVELS[this.levelIndex];
  }

  get collectedCount() {
    return this.collected.size;
  }

  loadLevel(index, keepScore) {
    this.levelIndex = index;
    if (!keepScore) this.score = 0;
    this.collected = new Set();
    this.launchesLeft = this.level.launches;
    this.launchesUsed = 0;
    this.combo = 0;
    this.flight = null;
    this.dragging = false;
    this.drag = null;
    this.preview = null;
    this.lastLaunchAt = -10;
    this.endLines = [];
    this.starsEarned = 0;
    this.renderer.buildBackdrop(index + 1);
    this.screen = SCREEN_PLAY;
  }

  startGame() {
    this.sound.unlock();
    this.loadLevel(0, false);
  }

  nextLevel() {
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.screen = SCREEN_WIN;
      this.sound.levelWin();
      if (this.score > this.best) this.saveBest();
      return;
    }
    this.loadLevel(this.levelIndex + 1, true);
  }

  saveBest() {
    this.best = this.score;
    try {
      window.localStorage.setItem('ember-orbit-best', String(this.best));
    } catch {
      // Best score is a nicety; a blocked store must not break play.
    }
  }

  restartLevel() {
    this.sound.click();
    this.loadLevel(this.levelIndex, true);
  }

  // Pointer position in canvas coordinates.
  pointerPos(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * FIELD_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * FIELD_HEIGHT,
    };
  }

  onPointerDown(event) {
    this.sound.unlock();
    const p = this.pointerPos(event);
    if (this.screen === SCREEN_TITLE) {
      this.startGame();
      return;
    }
    if (this.screen === SCREEN_LEVEL || this.screen === SCREEN_WIN) {
      this.nextLevel();
      return;
    }
    if (this.screen === SCREEN_OVER) {
      this.loadLevel(this.levelIndex, false);
      return;
    }
    if (this.screen !== SCREEN_PLAY || this.flight !== null) return;
    const e = this.level.ember;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    if (dx * dx + dy * dy > 90 * 90) return;
    this.dragging = true;
    this.drag = { x: p.x, y: p.y };
    this.updatePreview();
  }

  onPointerMove(event) {
    if (!this.dragging) return;
    this.drag = this.pointerPos(event);
    this.updatePreview();
  }

  onPointerUp() {
    if (!this.dragging) return;
    this.dragging = false;
    const p = this.drag;
    this.drag = null;
    this.preview = null;
    if (p === null) return;
    const e = this.level.ember;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len < MIN_DRAG) return;
    const speed = Math.min(len * DRAG_SCALE, MAX_LAUNCH_SPEED);
    this.launch(Math.atan2(dy, dx), speed);
  }

  // Click during flight: end the flight now and bank the shards collected so far.
  // Guard against the click that follows a drag-release launch: a fresh launch
  // must not be banked by its own release click.
  onPointerClick(event) {
    if (this.screen !== SCREEN_PLAY || this.flight === null || this.dragging) return;
    if (this.time - this.lastLaunchAt < 0.5) return;
    this.bankFlight('banked');
  }

  updatePreview() {
    if (this.drag === null) {
      this.preview = null;
      return;
    }
    const e = this.level.ember;
    const dx = e.x - this.drag.x;
    const dy = e.y - this.drag.y;
    const len = Math.hypot(dx, dy);
    if (len < MIN_DRAG) {
      this.preview = null;
      return;
    }
    const speed = Math.min(len * DRAG_SCALE, MAX_LAUNCH_SPEED);
    this.preview = previewPath(this.level, Math.atan2(dy, dx), speed);
  }

  launch(angle, speed) {
    if (this.launchesLeft <= 0) return;
    this.launchesLeft -= 1;
    this.launchesUsed += 1;
    this.flight = {
      x: this.level.ember.x,
      y: this.level.ember.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      time: 0,
      slow: 0,
      trail: [{ x: this.level.ember.x, y: this.level.ember.y }],
      trailAt: 0,
      got: [],
    };
    this.lastLaunchAt = this.time;
    this.sound.launch();
  }

  bankFlight(how) {
    const f = this.flight;
    this.flight = null;
    for (const i of f.got) this.collected.add(i);
    if (this.collected.size >= this.level.shards.length) {
      this.completeLevel();
      return;
    }
    if (how === 'crash' || how === 'swallow') this.sound.crash();
    if (this.launchesLeft <= 0) {
      this.screen = SCREEN_OVER;
      this.sound.gameOver();
      this.endLines = [
        `The ember faded with ${this.collected.size}/${this.level.shards.length} shards lit.`,
        'Click or press Enter to try this system again.',
      ];
    }
  }

  completeLevel() {
    const bonus = 250 * this.launchesLeft;
    this.score += bonus;
    this.starsEarned = this.launchesUsed <= this.level.par ? 3 : this.launchesUsed <= this.level.par + 1 ? 2 : 1;
    const stars = '★'.repeat(this.starsEarned) + '☆'.repeat(3 - this.starsEarned);
    this.endLines = [
      `${stars}   ${this.level.name} lit!`,
      `Launch bonus +${bonus}  ·  Score ${this.score}`,
      this.levelIndex + 1 >= LEVELS.length ? 'Click or press Enter for the finale.' : 'Click or press Enter for the next system.',
    ];
    this.screen = SCREEN_LEVEL;
    this.sound.levelWin();
  }

  onKey(event) {
    const k = event.key;
    if (k === 'Enter' || k === ' ') {
      if (this.screen === SCREEN_TITLE) this.startGame();
      else if (this.screen === SCREEN_LEVEL || this.screen === SCREEN_WIN) this.nextLevel();
      else if (this.screen === SCREEN_OVER) this.loadLevel(this.levelIndex, false);
      event.preventDefault();
      return;
    }
    if (k === 'r' || k === 'R') {
      if (this.screen === SCREEN_PLAY) this.restartLevel();
      return;
    }
    if (k === 'm' || k === 'M') {
      this.sound.unlock();
      this.sound.toggleMute();
    }
  }

  update(dt) {
    this.time += dt;
    if (this.screen !== SCREEN_PLAY || this.flight === null) return;
    const f = this.flight;
    let end = null;
    const steps = Math.max(1, Math.round(dt / STEP));
    for (let i = 0; i < steps; i += 1) {
      end = stepFlight(f, this.level);
      for (let j = 0; j < this.level.shards.length; j += 1) {
        if (this.collected.has(j) || f.got.indexOf(j) !== -1) continue;
        const sh = this.level.shards[j];
        const dx = f.x - sh.x;
        const dy = f.y - sh.y;
        if (dx * dx + dy * dy < (15 + EMBER_R) * (15 + EMBER_R)) {
          f.got.push(j);
          this.combo += 1;
          this.score += 100 * this.combo;
          this.sound.shard(this.combo);
        }
      }
      if (end !== null) break;
    }
    if (end === 'timeout') end = 'drift';
    if (end !== null) {
      this.bankFlight(end);
      this.combo = 0;
    }
  }

  draw() {
    const r = this.renderer;
    r.drawBackdrop(this.time);
    const level = this.level;
    for (const p of level.planets) r.drawPlanet(p, this.time);
    for (const b of level.blackHoles) r.drawBlackHole(b, this.time);
    for (let i = 0; i < level.shards.length; i += 1) {
      r.drawShard(level.shards[i], this.time, this.collected.has(i));
    }
    if (this.screen === SCREEN_TITLE) {
      r.drawEmber(level.ember.x, level.ember.y, this.time);
      r.drawTitle(this);
      return;
    }
    r.drawHud(this);
    if (this.flight !== null) {
      r.drawTrail(this.flight.trail);
      r.drawEmber(this.flight.x, this.flight.y, this.time);
    } else {
      r.drawEmber(level.ember.x, level.ember.y, this.time);
      if (this.dragging && this.drag !== null) {
        r.drawAimArrow(level.ember, this.drag);
      }
      if (this.preview !== null) r.drawPreview(this.preview.points);
    }
    if (this.screen === SCREEN_LEVEL) {
      r.drawPanel('SYSTEM LIT', this.endLines, '#ffd76a');
    } else if (this.screen === SCREEN_OVER) {
      r.drawPanel('THE EMBER FADED', this.endLines, '#ff7a6a');
    } else if (this.screen === SCREEN_WIN) {
      r.drawPanel('DAWN RETURNS', [
        `All ten systems lit — final score ${this.score}.`,
        `Best score ${Math.max(this.best, this.score)}.`,
        'Press Enter to fly it all again.',
      ], '#ffd76a');
    }
  }
}
