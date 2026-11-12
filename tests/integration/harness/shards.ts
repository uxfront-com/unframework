// The harness's slow test files, run as shards (ADR-0093). Vitest runs each file in one worker,
// so the slowest file sets the least time its project can take: the canaries' corpus check and
// each ssr project's server renders run as several files instead, which Vitest runs in parallel.
// Each shard file is one call with its index, and takes its share of one list by a rule, never by
// a hand-kept list, so a new canary or case lands in exactly one shard. `shards.unit.test.ts`
// holds the files on disk to the counts below.

/** The kinds of shard file: the canaries' corpus check, and the ssr projects' renders. */
export type ShardKind = "canaries-corpus" | "ssr";

/** How many shard files each kind has. One constant per kind, so a change is in one place. */
export const SHARDS: Readonly<Record<ShardKind, number>> = { "canaries-corpus": 4, ssr: 4 };

/** The share of `items` that shard `index` of `count` takes: every item whose position, modulo
 * the count, is the index. Over `0 … count - 1`, the shards hold every item exactly once. */
export function shardOf<T>(items: readonly T[], index: number, count: number): T[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`A shard count must be a whole number of at least 1, not ${count}.`);
  }
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new Error(`Shard ${index} is not one of the ${count} shards (0 to ${count - 1}).`);
  }
  return items.filter((_, position) => position % count === index);
}

/** The shard files of a kind, relative to the integration root: `harness/<kind>.<k>.<suffix>`. */
export function shardFiles(kind: ShardKind, count: number = SHARDS[kind]): string[] {
  const suffix = kind === "ssr" ? "test.ts" : "unit.test.ts";
  return Array.from({ length: count }, (_, index) => `harness/${kind}.${index}.${suffix}`);
}
