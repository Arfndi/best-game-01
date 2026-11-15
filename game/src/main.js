// Ember Orbit — bootstrap.
// Sizes the canvas to the window (keeping the 1280x720 playfield), wires pointer and
// keyboard input, and runs the frame loop. A `?shot=start|play|end&seed=N` query
// switches to screenshot mode: the game stages that scene deterministically and draws
// it, so a headless browser captures exactly the frame the maker intended.

import { FIELD_HEIGHT, FIELD_WIDTH } from './levels.js';
import { Game } from './game.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') || 1) || 1;

function fitCanvas() {
  const scale = Math.min(window.innerWidth / FIELD_WIDTH, window.innerHeight / FIELD_HEIGHT);
  canvas.style.width = `${Math.floor(FIELD_WIDTH * scale)}px`;
  canvas.style.height = `${Math.floor(FIELD_HEIGHT * scale)}px`;
}

const game = new Game(canvas);
canvas.width = FIELD_WIDTH;
canvas.height = FIELD_HEIGHT;
fitCanvas();
window.addEventListener('resize', fitCanvas);

canvas.addEventListener('pointerdown', (event) => game.onPointerDown(event));
window.addEventListener('pointermove', (event) => game.onPointerMove(event));
window.addEventListener('pointerup', () => game.onPointerUp());
window.addEventListener('keydown', (event) => game.onKey(event));
// Keep the page from scrolling while the player drags on touch screens.
canvas.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });

if (shot) {
  // Screenshot mode: stage the scene once, draw it, and keep redrawing the same
  // frozen frame so the capture is stable whenever the browser takes it. The canvas
  // is pinned to exactly the playfield size here: headless browsers report a smaller
  // viewport than their window, and a fitted canvas would leave black bars in the shot.
  canvas.style.width = '1280px';
  canvas.style.height = '720px';
  game.renderer.buildBackdrop(game.level.name, seed);
  stageShot(shot, game);
  game.draw();
  const frozen = () => {
    game.draw();
    window.requestAnimationFrame(frozen);
  };
  window.requestAnimationFrame(frozen);
} else {
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.draw();
    window.requestAnimationFrame(frame);
  };
  window.requestAnimationFrame(frame);
}
