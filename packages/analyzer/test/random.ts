/** A small deterministic PRNG (mulberry32), so a seed always gives the same samples. */
export function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` strings of one to six pieces each, drawn from `pieces` with the seed. */
export function randomSamples(seed: number, count: number, pieces: readonly string[]): string[] {
  const next = random(seed);
  return Array.from({ length: count }, () =>
    Array.from(
      { length: 1 + Math.floor(next() * 6) },
      () => pieces[Math.floor(next() * pieces.length)]!,
    ).join(""),
  );
}
