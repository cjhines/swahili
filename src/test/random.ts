/** Deterministic stand-in for Math.random (mulberry32), so shuffles are repeatable in tests. */
export const seededRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const minutes = (n: number) => n * 60_000;
export const days = (n: number) => n * 86_400_000;
export const later = (date: Date, ms: number) => new Date(date.getTime() + ms);
