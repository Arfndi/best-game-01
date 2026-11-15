// All drawing for Ember Orbit — canvas only, no images. The backdrop is a seeded
// starfield with nebula blobs (same seed, same sky). Planets are radial-gradient
// spheres with a lit edge and an optional ring; black holes are a dark disc with a
// bright accretion ring; shards are spinning gold diamonds; the ember is a glowing
// ball with a fading trail. The HUD and the title / level-end / game-over panels
// are drawn on the same canvas so screenshots show the whole game.
import { FIELD_WIDTH, FIELD_HEIGHT } from './levels.js';
import { EMBER_R } from './physics.js';
import { makeStars, makeNebulae } from './rng.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVEL = 'level';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const GOLD = '#ffd76a';
const EMBER_CORE = '#fff3c4';
const EMBER_MID = '#ffb347';
const EMBER_EDGE = '#ff5e3a';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stars = [];
    this.nebulae = [];
    this.seed = 1;
  }

  // (Re)build the backdrop for a level; seed = level index + 1 keeps skies distinct.
  buildBackdrop(seed) {
    this.seed = seed;
    this.stars = makeStars(seed * 1013 + 7, 220, FIELD_WIDTH, FIELD_HEIGHT);
    this.nebulae = makeNebulae(seed * 331 + 11, 4, FIELD_WIDTH, FIELD_HEIGHT);
  }

  drawBackdrop(time) {
    const ctx = this.ctx;
    ctx.fillStyle = '#070b1d';
    ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    for (const n of this.nebulae) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, `hsla(${n.hue}, 70%, 45%, ${n.alpha})`);
      g.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    for (const s of this.stars) {
      const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(time * 1.4 + s.tw));
      ctx.fillStyle = s.warm ? `rgba(255, 220, 160, ${a})` : `rgba(210, 225, 255, ${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPlanet(p, time) {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.1, p.x, p.y, p.r);
    g.addColorStop(0, '#fff7e0');
    g.addColorStop(0.35, p.color);
    g.addColorStop(1, '#1a1030');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    // Lit rim facing up-left, and a faint atmosphere.
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r - 1, Math.PI * 0.9, Math.PI * 1.7);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160, 190, 255, 0.18)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 4, 0, Math.PI * 2);
    ctx.stroke();
    if (p.ring) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-0.42);
      ctx.strokeStyle = 'rgba(255, 220, 150, 0.5)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 1.7, p.r * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    void time;
  }

  drawBlackHole(b, time) {
    const ctx = this.ctx;
    const spin = time * 0.9;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(spin * 0.15);
    const g = ctx.createRadialGradient(0, 0, b.r * 0.2, 0, 0, b.r * 2.6);
    g.addColorStop(0, 'rgba(180, 120, 255, 0.5)');
    g.addColorStop(0.5, 'rgba(120, 60, 220, 0.16)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, b.r * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8c8ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, b.r * 1.9, b.r * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 180, 120, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, b.r * 1.5, b.r * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 200, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawShard(s, time, collected) {
    if (collected) return;
    const ctx = this.ctx;
    const spin = time * 1.6 + s.x * 0.01;
    const pulse = 0.75 + 0.25 * Math.sin(time * 3 + s.y * 0.02);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(spin * 0.25);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 26 * pulse);
    glow.addColorStop(0, 'rgba(255, 215, 106, 0.55)');
    glow.addColorStop(1, 'rgba(255, 215, 106, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-26, -26, 52, 52);
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 11);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 4);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawTrail(trail) {
    const ctx = this.ctx;
    if (trail.length < 2) return;
    for (let i = 1; i < trail.length; i += 1) {
      const a = i / trail.length;
      ctx.strokeStyle = `rgba(255, ${140 + Math.floor(80 * a)}, 60, ${0.12 + 0.6 * a})`;
      ctx.lineWidth = 1 + 3 * a;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
  }

  drawEmber(x, y, time) {
    const ctx = this.ctx;
    const flicker = 1 + 0.08 * Math.sin(time * 9);
    const g = ctx.createRadialGradient(x, y, 0, x, y, EMBER_R * 3.2 * flicker);
    g.addColorStop(0, EMBER_CORE);
    g.addColorStop(0.35, EMBER_MID);
    g.addColorStop(0.65, EMBER_EDGE);
    g.addColorStop(1, 'rgba(255, 94, 58, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, EMBER_R * 3.2 * flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = EMBER_CORE;
    ctx.beginPath();
    ctx.arc(x, y, EMBER_R * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPreview(points) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, i % 6 === 0 ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawAimArrow(from, to) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawHud(game) {
    const ctx = this.ctx;
    const level = game.level;
    ctx.fillStyle = 'rgba(5, 8, 24, 0.62)';
    roundRect(ctx, 12, 12, FIELD_WIDTH - 24, 54, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`LEVEL ${game.levelIndex + 1}/10  ·  ${level.name}`, 28, 40);
    ctx.textAlign = 'right';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = GOLD;
    ctx.fillText(`★ ${game.score}`, 700, 40);
    ctx.fillStyle = '#fff';
    ctx.fillText(`Launches ${game.launchesLeft}`, 880, 40);
    ctx.fillText(`Shards ${game.collectedCount}/${level.shards.length}`, 1080, 40);
    if (game.combo > 1) {
      ctx.fillStyle = '#ffb347';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`COMBO x${game.combo}`, FIELD_WIDTH / 2, 84);
    }
    ctx.textAlign = 'left';
  }

  drawPanel(title, lines, accent) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(4, 6, 18, 0.55)';
    ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    const w = 620;
    const h = 150 + lines.length * 38;
    const x = (FIELD_WIDTH - w) / 2;
    const y = (FIELD_HEIGHT - h) / 2;
    ctx.fillStyle = 'rgba(10, 14, 36, 0.94)';
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = accent || GOLD;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 18);
    ctx.stroke();
    ctx.fillStyle = accent || GOLD;
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, FIELD_WIDTH / 2, y + 52);
    ctx.fillStyle = '#e8ecff';
    ctx.font = '21px system-ui, sans-serif';
    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i], FIELD_WIDTH / 2, y + 108 + i * 38);
    }
    ctx.textAlign = 'left';
  }

  drawTitle(game) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(4, 6, 18, 0.45)';
    ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText('EMBER ORBIT', FIELD_WIDTH / 2, 210);
    ctx.fillStyle = '#fff';
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText('The last ember of a dying star. Slingshot it home.', FIELD_WIDTH / 2, 262);
    ctx.fillStyle = '#c9d2ff';
    ctx.font = '21px system-ui, sans-serif';
    ctx.fillText('Drag back from the ember to aim — release to launch.', FIELD_WIDTH / 2, 330);
    ctx.fillText('Collect every star shard. Mind the black holes.', FIELD_WIDTH / 2, 362);
    ctx.fillText('Click mid-flight to bank your shards early.  R restarts · M mutes.', FIELD_WIDTH / 2, 394);
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('Press ENTER or click to play', FIELD_WIDTH / 2, 470);
    ctx.fillStyle = '#9aa5d8';
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillText(`Best score: ${game.best}`, FIELD_WIDTH / 2, 520);
    ctx.textAlign = 'left';
  }
}
