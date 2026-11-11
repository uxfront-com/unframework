// The size of a property test, from the environment. CI runs every property test at its full
// size, with its own seed, exactly as written. A local run takes a smaller seeded sample, so a
// repeat run stays fast, and a failure names the seed and the size that replay it.
//
//   UF_PROPERTY_RUNS=<n>   runs n samples (at most the full size), in CI too
//   UF_PROPERTY_SEED=<n>   draws the samples with seed n, to replay a failure
import { random } from "./random.ts";

type Env = Readonly<Record<string, string | undefined>>;

/** The samples a local run takes, when neither CI nor `UF_PROPERTY_RUNS` says otherwise. */
export const LOCAL_RUNS = 500;

/** Whether `CI` is set to anything but `0` or `false`, as CI providers set it. */
export function isCI(env: Env): boolean {
  const value = env.CI?.trim();
  return Boolean(value) && value !== "0" && value !== "false";
}

/** One run of a property test: the seed it draws with, and how many of `full` it takes. */
export interface PropertyRun {
  readonly seed: number;
  readonly size: number;
  readonly full: number;
}

/** A positive whole number from a variable, or `undefined` when it is unset. */
function count(env: Env, name: string, minimum: number): number | undefined {
  const value = env[name]?.trim();
  if (!value) return undefined;
  if (!/^\d+$/.test(value) || Number(value) < minimum || Number(value) > 0xffff_ffff) {
    throw new Error(
      `${name} must be a whole number from ${minimum} to 4294967295, not "${value}".`,
    );
  }
  return Number(value);
}

/** A random seed, for a local run that takes a sample. */
const fresh = (): number => crypto.getRandomValues(new Uint32Array(1))[0]!;

/**
 * The run of a property test of `full` samples whose own seed is `seed`. At full size it keeps
 * that seed, so CI draws what it always drew. A smaller local run draws with a fresh seed, so
 * repeat runs cover different samples.
 */
export function propertyRun(full: number, seed: number, env: Env = process.env): PropertyRun {
  const runs = count(env, "UF_PROPERTY_RUNS", 1);
  const replay = count(env, "UF_PROPERTY_SEED", 0);
  const size = Math.min(full, runs ?? (isCI(env) ? full : LOCAL_RUNS));
  return { seed: replay ?? (size === full ? seed : fresh()), size, full };
}

/**
 * The items a run takes from an exhaustive list: all of them, in order, at full size, and
 * otherwise a seeded sample from all of it, not a prefix, still in the list's order.
 */
export function sampleOf<T>(items: readonly T[], run: PropertyRun): T[] {
  if (items.length !== run.full) {
    throw new Error(`The run is for ${run.full} items, not ${items.length}.`);
  }
  if (run.size >= items.length) return [...items];
  // A partial Fisher–Yates shuffle of the indices: the first `size` are the sample.
  const next = random(run.seed);
  const indices = items.map((_, index) => index);
  for (let index = 0; index < run.size; index++) {
    const other = index + Math.floor(next() * (indices.length - index));
    [indices[index], indices[other]] = [indices[other]!, indices[index]!];
  }
  return indices
    .slice(0, run.size)
    .toSorted((a, b) => a - b)
    .map((index) => items[index]!);
}

/**
 * The count a run must exceed, from `bound`, the one the full size must exceed. At full size it
 * is `bound`. A sample's count varies by chance, so a smaller run scales the bound to its size
 * and allows four standard deviations of a binomial count below it (at most `2√size`): the count
 * must reach that, rounded up. A run too small for any floor gets -1, which every count exceeds.
 * With the rates the tests see today, a correct analyser falls under it less than once in 250,000
 * runs at any size.
 */
export function scaledBound(bound: number, run: PropertyRun): number {
  if (run.size >= run.full) return bound;
  const least = (bound * run.size) / run.full - 2 * Math.sqrt(run.size);
  return Math.max(-1, Math.ceil(least) - 1);
}

/** Runs a property test's body, and names the run that replays it when the body fails. */
export function replayable(run: PropertyRun, body: (run: PropertyRun) => void): void {
  try {
    body(run);
  } catch (error) {
    if (error instanceof Error) {
      error.message += `\n\nProperty run: seed ${run.seed}, ${run.size} of ${run.full} samples. Replay it with UF_PROPERTY_SEED=${run.seed} UF_PROPERTY_RUNS=${run.size}.`;
    }
    throw error;
  }
}
