// Ember Orbit — the ten star systems.
// A level is one slingshot puzzle: a fixed ember start, a set of gravity planets (and,
// from level 5, black holes that pull hard and swallow anything that touches them), a set
// of star shards to collect, and a launch budget. Shards stay collected between launches,
// so a level is a plan spread over several flights, not one perfect shot.
// Coordinates live in the 1280x720 playfield. `pull` is a planet's gravity strength:
// acceleration toward its centre is pull / distance^2. `move` makes a planet drift on a
// sine path (amplitude in px, period in seconds, phase in radians).

export const FIELD_WIDTH = 1280;
export const FIELD_HEIGHT = 720;
export const EMBER_RADIUS = 10;
export const SHARD_RADIUS = 14;

export const LEVELS = [
  {
    name: 'First Light',
    hint: 'Drag back from the ember, aim with the dotted arc, release to launch.',
    start: { x: 150, y: 360 },
    launches: 3,
    par: 2,
    planets: [{ x: 640, y: 360, r: 44, pull: 14000000, hue: 210, ring: false }],
    shards: [
      { x: 640, y: 180 },
      { x: 830, y: 360 },
      { x: 640, y: 540 },
    ],
  },
  {
    name: 'Twin Pull',
    hint: 'Two wells bend one flight. Thread the gap to reach the far shards.',
    start: { x: 140, y: 360 },
    launches: 4,
    par: 3,
    planets: [
      { x: 480, y: 280, r: 38, pull: 10000000, hue: 190, ring: false },
      { x: 800, y: 440, r: 38, pull: 10000000, hue: 280, ring: false },
    ],
    shards: [
      { x: 480, y: 120 },
      { x: 800, y: 600 },
      { x: 950, y: 280 },
      { x: 330, y: 440 },
    ],
  },
  {
    name: 'Ringed Giant',
    hint: 'The giant pulls hard. Slingshot around it — never through it.',
    start: { x: 140, y: 360 },
    launches: 4,
    par: 3,
    planets: [{ x: 700, y: 360, r: 64, pull: 22000000, hue: 32, ring: true }],
    shards: [
      { x: 700, y: 150 },
      { x: 950, y: 360 },
      { x: 700, y: 570 },
      { x: 520, y: 180 },
    ],
  },
  {
    name: 'The Gauntlet',
    hint: 'Three wells, four shards. Chain them in one long flight for the combo.',
    start: { x: 120, y: 360 },
    launches: 5,
    par: 3,
    planets: [
      { x: 420, y: 240, r: 30, pull: 8000000, hue: 150, ring: false },
      { x: 860, y: 240, r: 30, pull: 8000000, hue: 320, ring: false },
      { x: 640, y: 520, r: 40, pull: 12000000, hue: 210, ring: false },
    ],
    shards: [
      { x: 420, y: 90 },
      { x: 860, y: 90 },
      { x: 640, y: 660 },
      { x: 1080, y: 360 },
    ],
  },
  {
    name: 'Black Heart',
    hint: 'A black hole swallows anything that touches it. Give it a wide berth.',
    start: { x: 120, y: 180 },
    launches: 5,
    par: 4,
    planets: [
      { x: 640, y: 360, r: 26, pull: 30000000, hue: 265, blackHole: true },
      { x: 1000, y: 180, r: 30, pull: 8000000, hue: 190, ring: false },
    ],
    shards: [
      { x: 640, y: 120 },
      { x: 300, y: 540 },
      { x: 980, y: 540 },
      { x: 1120, y: 360 },
    ],
  },
  {
    name: 'Drifters',
    hint: 'The big world drifts. Time your launch to where it will be, not where it is.',
    start: { x: 120, y: 360 },
    launches: 5,
    par: 4,
    planets: [
      {
        x: 640, y: 300, r: 40, pull: 12000000, hue: 45, ring: false,
        move: { dx: 150, dy: 0, period: 8, phase: 0 },
      },
      { x: 950, y: 520, r: 30, pull: 9000000, hue: 280, ring: false },
    ],
    shards: [
      { x: 640, y: 120 },
      { x: 1100, y: 300 },
      { x: 300, y: 600 },
      { x: 800, y: 600 },
    ],
  },
  {
    name: 'Crosswinds',
    hint: 'Two equal wells pull opposite ways. The middle shard is the trap.',
    start: { x: 120, y: 360 },
    launches: 5,
    par: 4,
    planets: [
      { x: 400, y: 360, r: 36, pull: 11000000, hue: 170, ring: false },
      { x: 880, y: 360, r: 36, pull: 11000000, hue: 350, ring: false },
    ],
    shards: [
      { x: 400, y: 140 },
      { x: 880, y: 580 },
      { x: 640, y: 120 },
      { x: 640, y: 600 },
    ],
  },
  {
    name: 'The Crown',
    hint: 'Three wells in a crown. The centre shard needs a slow, brave arc.',
    start: { x: 120, y: 120 },
    launches: 6,
    par: 4,
    planets: [
      { x: 640, y: 200, r: 34, pull: 11000000, hue: 210, ring: false },
      { x: 480, y: 480, r: 34, pull: 11000000, hue: 280, ring: false },
      { x: 800, y: 480, r: 34, pull: 11000000, hue: 32, ring: true },
    ],
    shards: [
      { x: 640, y: 360 },
      { x: 300, y: 360 },
      { x: 980, y: 360 },
      { x: 640, y: 640 },
    ],
  },
  {
    name: 'Event Horizon',
    hint: 'The hole owns the right side. Use the left well to bend around it.',
    start: { x: 120, y: 360 },
    launches: 6,
    par: 5,
    planets: [
      { x: 420, y: 360, r: 40, pull: 13000000, hue: 190, ring: false },
      { x: 900, y: 360, r: 30, pull: 34000000, hue: 265, blackHole: true },
    ],
    shards: [
      { x: 200, y: 120 },
      { x: 420, y: 600 },
      { x: 1100, y: 120 },
      { x: 1100, y: 600 },
      { x: 640, y: 360 },
    ],
  },
  {
    name: 'Last Ember',
    hint: 'Everything you have learned, in one system. Light them all.',
    start: { x: 120, y: 360 },
    launches: 7,
    par: 5,
    planets: [
      { x: 380, y: 220, r: 36, pull: 11000000, hue: 170, ring: false },
      { x: 900, y: 220, r: 36, pull: 11000000, hue: 350, ring: false },
      { x: 640, y: 540, r: 48, pull: 16000000, hue: 45, ring: true },
      { x: 1150, y: 600, r: 22, pull: 20000000, hue: 265, blackHole: true },
    ],
    shards: [
      { x: 380, y: 80 },
      { x: 900, y: 80 },
      { x: 640, y: 300 },
      { x: 200, y: 600 },
      { x: 1080, y: 480 },
    ],
  },
];

/** A planet's centre at flight-time `t` (seconds since the launch began). */
export function planetAt(planet, t) {
  if (!planet.move) return { x: planet.x, y: planet.y };
  const w = (Math.PI * 2 * t) / planet.move.period + planet.move.phase;
  return {
    x: planet.x + planet.move.dx * Math.sin(w),
    y: planet.y + planet.move.dy * Math.sin(w),
  };
}
