// Seeded randomness for Ember Orbit. Every random value in the game comes from a
// mulberry32 stream seeded per level, so the same seed always draws the same sky
// and the same frame — the game is fully deterministic for a given seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build a deterministic starfield: count stars with x, y, radius and brightness.
export function makeStars(seed, count, width, height) {
  const rand = mulberry32(seed);
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: rand() * width,
      y: rand() * height,
      r: 0.5 + rand() * 1.6,
      tw: rand() * Math.PI * 2,
      warm: rand() < 0.25,
    });
  }
  return stars;
}

// A few soft nebula blobs, placed deterministically, for the backdrop.
export function makeNebulae(seed, count, width, height) {
  const rand = mulberry32(seed + 7919);
  const hues = [265, 210, 320, 190, 280];
  const blobs = [];
  for (let i = 0; i < count; i += 1) {
    blobs.push({
      x: rand() * width,
      y: rand() * height,
      r: 160 + rand() * 260,
      hue: hues[i % hues.length],
      alpha: 0.05 + rand() * 0.06,
    });
  }
  return blobs;
}
