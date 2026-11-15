// Ember Orbit — deterministic randomness.
// Every random choice in the game (starfield, nebula blobs, particle spray) comes from a
// seeded generator, so the same seed always paints the same sky. The flight simulation
// itself uses no randomness at all: a launch is pure physics, replayable to the pixel.

/** Mulberry32: a tiny, fast seeded PRNG with a full 32-bit period. */
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

/** A small helper bundle around one seeded stream: ranges, picks and shuffles. */
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    /** Uniform float in [min, max). */
    range(min, max) {
      return min + (max - min) * next();
    },
    /** Uniform integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One element of an array, uniformly. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    /** A new array with the elements in shuffled order (Fisher-Yates). */
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
  };
}

/** Hash a short string into a 32-bit seed, so level names can seed their own skies. */
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
