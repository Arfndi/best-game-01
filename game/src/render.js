// Ember Orbit — everything the player sees.
// One canvas, drawn in layers: a pre-rendered deep-space backdrop (nebula clouds and a
// twinkling starfield, painted once per level from a seeded RNG), then planets, shards,
// the ember and its trail, then the HUD, then whichever screen is on top. All art is
// code: gradients, arcs and glow — no image files ship with the game.

import { FIELD_HEIGHT, FIELD_WIDTH, planetAt } from './levels.js';
import { hashSeed, makeRng } from './rng.js';

const TAU = Math.PI * 2;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.backdrop = null;
    this.stars = [];
  }

  /** Paint the backdrop for a level: nebula wash + stars, from the level's seed. */
  buildBackdrop(levelName, seed) {
    const rng = makeRng(hashSeed(levelName) ^ (seed * 2654435761));
    const off = document.createElement('canvas');
    off.width = FIELD_WIDTH;
    off.height = FIELD_HEIGHT;
    const c = off.getContext('2d');
    // Deep space base.
    const base = c.createLinearGradient(0, 0, 0, FIELD_HEIGHT);
    base.addColorStop(0, '#070a1c');
    base.addColorStop(0.55, '#0d1030');
    base.addColorStop(1, '#05060f');
    c.fillStyle = base;
    c.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    // Nebula clouds: big soft radial washes in teal, violet and ember orange.
    const clouds = ['#123a5e', '#3d1e63', '#5e2a12', '#0f3d3a', '#2a1a55'];
    for (let i = 0; i < 9; i += 1) {
      const x = rng.range(0, FIELD_WIDTH);
      const y = rng.range(0, FIELD_HEIGHT);
      const r = rng.range(140, 320);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(rng.pick(clouds), 0.5));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Stars, recorded so they can twinkle later.
    this.stars = [];
    for (let i = 0; i < 210; i += 1) {
      const star = {
        x: rng.range(0, FIELD_WIDTH),
        y: rng.range(0, FIELD_HEIGHT),
        r: rng.range(0.5, 1.9),
        phase: rng.range(0, TAU),
        speed: rng.range(0.4, 1.6),
        warm: rng.next() < 0.25,
      };
      this.stars.push(star);
      c.fillStyle = star.warm ? '#ffd9a0' : '#dfe8ff';
      c.globalAlpha = 0.9;
      c.beginPath();
      c.arc(star.x, star.y, star.r, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    this.backdrop = off;
  }

  drawBackdrop(time) {
    const c = this.ctx;
    c.drawImage(this.backdrop, 0, 0);
    // Twinkle: a few stars breathe over the painted ones.
    for (const star of this.stars) {
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase));
      c.globalAlpha = a;
      c.fillStyle = star.warm ? '#ffd9a0' : '#ffffff';
      c.beginPath();
      c.arc(star.x, star.y, star.r + 0.4, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  drawPlanet(planet, t, time) {
    const c = this.ctx;
    const p = planetAt(planet, t);
    const glowR = planet.r * 2.6;
    if (planet.blackHole) {
      // Event horizon: a black disc, a violet accretion glow and a bent-light ring.
      const glow = c.createRadialGradient(p.x, p.y, planet.r * 0.4, p.x, p.y, glowR);
      glow.addColorStop(0, 'rgba(150,90,255,0.55)');
      glow.addColorStop(0.5, 'rgba(90,40,180,0.18)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = glow;
      c.beginPath();
      c.arc(p.x, p.y, glowR, 0, TAU);
      c.fill();
      c.fillStyle = '#000000';
      c.beginPath();
      c.arc(p.x, p.y, planet.r, 0, TAU);
      c.fill();
      c.strokeStyle = '#c9a6ff';
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(p.x, p.y, planet.r + 3, 0, TAU);
      c.stroke();
      // Accretion ring, tilted and slowly spinning.
      c.save();
      c.translate(p.x, p.y);
      c.rotate(-0.35 + Math.sin(time * 0.2) * 0.05);
      c.strokeStyle = 'rgba(200,150,255,0.8)';
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(0, 0, planet.r * 1.9, planet.r * 0.55, 0, 0, TAU);
      c.stroke();
      c.restore();
      return;
    }
    const hue = planet.hue;
    const glow = c.createRadialGradient(p.x, p.y, planet.r * 0.5, p.x, p.y, glowR);
    glow.addColorStop(0, `hsla(${hue},80%,60%,0.5)`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(p.x, p.y, glowR, 0, TAU);
    c.fill();
    // Body: lit from the top-left, darker toward the rim.
    const body = c.createRadialGradient(
      p.x - planet.r * 0.35, p.y - planet.r * 0.35, planet.r * 0.1,
      p.x, p.y, planet.r,
    );
    body.addColorStop(0, `hsl(${hue},75%,68%)`);
    body.addColorStop(0.6, `hsl(${hue},65%,42%)`);
    body.addColorStop(1, `hsl(${hue},70%,22%)`);
    c.fillStyle = body;
    c.beginPath();
    c.arc(p.x, p.y, planet.r, 0, TAU);
    c.fill();
    // Craters: a few darker patches for texture.
    c.fillStyle = `hsla(${hue},60%,30%,0.55)`;
    const craters = [
      [-0.3, -0.1, 0.22], [0.25, 0.3, 0.16], [0.1, -0.45, 0.12], [-0.45, 0.35, 0.14],
    ];
    for (const [ox, oy, or_] of craters) {
      c.beginPath();
      c.arc(p.x + ox * planet.r, p.y + oy * planet.r, or_ * planet.r, 0, TAU);
      c.fill();
    }
    if (planet.ring) {
      c.save();
      c.translate(p.x, p.y);
      c.rotate(-0.4);
      c.strokeStyle = `hsla(${hue},70%,75%,0.85)`;
      c.lineWidth = 4;
      c.beginPath();
      c.ellipse(0, 0, planet.r * 1.75, planet.r * 0.5, 0, 0, TAU);
      c.stroke();
      c.strokeStyle = `hsla(${hue},70%,75%,0.35)`;
      c.lineWidth = 9;
      c.beginPath();
      c.ellipse(0, 0, planet.r * 2.0, planet.r * 0.62, 0, 0, TAU);
      c.stroke();
      c.restore();
    }
  }

  drawShard(shard, time, taken) {
    if (taken) return;
    const c = this.ctx;
    const pulse = 1 + 0.12 * Math.sin(time * 3 + shard.x);
    const r = 13 * pulse;
    const glow = c.createRadialGradient(shard.x, shard.y, 0, shard.x, shard.y, r * 2.4);
    glow.addColorStop(0, 'rgba(255,214,90,0.7)');
    glow.addColorStop(1, 'rgba(255,214,90,0)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(shard.x, shard.y, r * 2.4, 0, TAU);
    c.fill();
    // Four-point star.
    c.save();
    c.translate(shard.x, shard.y);
    c.rotate(time * 0.6);
    c.fillStyle = '#ffe27a';
    c.beginPath();
    c.moveTo(0, -r);
    c.quadraticCurveTo(0, 0, r, 0);
    c.quadraticCurveTo(0, 0, 0, r);
    c.quadraticCurveTo(0, 0, -r, 0);
    c.quadraticCurveTo(0, 0, 0, -r);
    c.fill();
    c.fillStyle = '#fff7d6';
    c.beginPath();
    c.arc(0, 0, r * 0.32, 0, TAU);
    c.fill();
    c.restore();
  }

  drawEmber(x, y, trail, time) {
    const c = this.ctx;
    // Trail: fading orange ribbon behind the ember.
    for (let i = 1; i < trail.length; i += 1) {
      const a = i / trail.length;
      const p0 = trail[i - 1];
      const p1 = trail[i];
      c.strokeStyle = `rgba(255,${140 + Math.floor(60 * a)},40,${0.15 + 0.55 * a})`;
      c.lineWidth = 1 + 5 * a;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(p0.x, p0.y);
      c.lineTo(p1.x, p1.y);
      c.stroke();
    }
    const flicker = 1 + 0.08 * Math.sin(time * 11) + 0.05 * Math.sin(time * 23);
    const glow = c.createRadialGradient(x, y, 0, x, y, 42 * flicker);
    glow.addColorStop(0, 'rgba(255,220,130,0.95)');
    glow.addColorStop(0.35, 'rgba(255,150,50,0.55)');
    glow.addColorStop(1, 'rgba(255,120,30,0)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(x, y, 42 * flicker, 0, TAU);
    c.fill();
    c.fillStyle = '#fff3c4';
    c.beginPath();
    c.arc(x, y, 9 * flicker, 0, TAU);
    c.fill();
    c.fillStyle = '#ff9a2a';
    c.beginPath();
    c.arc(x, y, 5.5 * flicker, 0, TAU);
    c.fill();
  }

  drawAim(start, aimAngle, aimSpeed, preview) {
    const c = this.ctx;
    // Dotted predicted arc.
    c.fillStyle = 'rgba(255,220,140,0.9)';
    for (let i = 0; i < preview.length; i += 1) {
      const p = preview[i];
      c.beginPath();
      c.arc(p.x, p.y, i % 2 === 0 ? 3 : 2, 0, TAU);
      c.fill();
    }
    // Power ring around the ember: fuller means a faster launch.
    const power = (aimSpeed - 140) / (560 - 140);
    c.strokeStyle = 'rgba(255,220,140,0.9)';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(start.x, start.y, 26, -Math.PI / 2, -Math.PI / 2 + TAU * power);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(start.x, start.y, 26, -Math.PI / 2 + TAU * power, -Math.PI / 2 + TAU);
    c.stroke();
  }

  drawHud(state) {
    const c = this.ctx;
    const level = state.level;
    c.textBaseline = 'alphabetic';
    // Top-left: level name and number.
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.font = '700 22px system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillText(`LEVEL ${state.levelIndex + 1} · ${level.name.toUpperCase()}`, 24, 38);
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.font = '15px system-ui, sans-serif';
    c.fillText(level.hint, 24, 62);
    // Top-right: score and best.
    c.textAlign = 'right';
    c.fillStyle = '#ffe27a';
    c.font = '700 26px system-ui, sans-serif';
    c.fillText(`SCORE ${state.score}`, FIELD_WIDTH - 24, 38);
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.font = '15px system-ui, sans-serif';
    c.fillText(`BEST ${state.best}`, FIELD_WIDTH - 24, 62);
    // Bottom-left: launches left as little embers.
    for (let i = 0; i < level.launches; i += 1) {
      const x = 34 + i * 30;
      const y = FIELD_HEIGHT - 30;
      const lit = i < state.launchesLeft;
      c.globalAlpha = lit ? 1 : 0.22;
      const g = c.createRadialGradient(x, y, 0, x, y, 12);
      g.addColorStop(0, '#fff3c4');
      g.addColorStop(0.5, '#ff9a2a');
      g.addColorStop(1, 'rgba(255,120,30,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, 12, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.font = '15px system-ui, sans-serif';
    c.textAlign = 'left';
    c.fillText('LAUNCHES', 34, FIELD_HEIGHT - 48);
    // Bottom-right: shards collected.
    c.textAlign = 'right';
    c.fillStyle = '#ffe27a';
    c.font = '700 20px system-ui, sans-serif';
    c.fillText(`◆ ${state.collected.size} / ${level.shards.length}`, FIELD_WIDTH - 24, FIELD_HEIGHT - 30);
    // Combo flash.
    if (state.combo > 1 && state.comboTimer > 0) {
      c.textAlign = 'center';
      c.fillStyle = `rgba(255,214,90,${Math.min(1, state.comboTimer)})`;
      c.font = '700 30px system-ui, sans-serif';
      c.fillText(`COMBO x${state.combo}`, FIELD_WIDTH / 2, 110);
    }
  }

  drawPanel(title, lines, accent) {
    const c = this.ctx;
    const w = 620;
    const h = 150 + lines.length * 34;
    const x = (FIELD_WIDTH - w) / 2;
    const y = (FIELD_HEIGHT - h) / 2;
    c.fillStyle = 'rgba(4,6,18,0.72)';
    c.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    c.fillStyle = 'rgba(10,14,34,0.95)';
    c.strokeStyle = accent;
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(x, y, w, h, 18);
    c.fill();
    c.stroke();
    c.textAlign = 'center';
    c.fillStyle = accent;
    c.font = '700 44px system-ui, sans-serif';
    c.fillText(title, FIELD_WIDTH / 2, y + 72);
    c.fillStyle = 'rgba(255,255,255,0.88)';
    c.font = '19px system-ui, sans-serif';
    lines.forEach((line, i) => {
      c.fillText(line, FIELD_WIDTH / 2, y + 118 + i * 34);
    });
  }

  drawTitle(best) {
    const c = this.ctx;
    c.textAlign = 'center';
    c.fillStyle = '#ffd27a';
    c.font = '700 84px system-ui, sans-serif';
    c.fillText('EMBER ORBIT', FIELD_WIDTH / 2, 250);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.font = '24px system-ui, sans-serif';
    c.fillText('Slingshot the last ember through ten dying star systems.', FIELD_WIDTH / 2, 300);
    c.fillText('Collect every star shard. Mind the gravity — and the dark.', FIELD_WIDTH / 2, 334);
    c.fillStyle = '#ffe27a';
    c.font = '700 26px system-ui, sans-serif';
    c.fillText('DRAG BACK TO AIM · RELEASE TO LAUNCH · R TO RESTART', FIELD_WIDTH / 2, 420);
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.font = '20px system-ui, sans-serif';
    c.fillText('CLICK ANYWHERE TO BEGIN', FIELD_WIDTH / 2, 470);
    if (best > 0) {
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.font = '18px system-ui, sans-serif';
      c.fillText(`BEST SCORE ${best}`, FIELD_WIDTH / 2, 510);
    }
  }
}
