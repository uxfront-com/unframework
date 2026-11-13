# ADR-0093: The slow harness files run as shards, and Angular's ngtsc compiles in a pool

- **Status:** Accepted
- **Date:** 2026-11-12
- **Plan:** §7.3 (the projects), §7.7, P2, R5; amends ADR-0024 (decision 5) and ADR-0027

## Context

Vitest runs each test file in one worker, so a project takes at least as long as its slowest file.
Measured on an M4 Max with 14 cores:

- In `harness`, the canaries' `every canary on the corpus` block took 72 of the 73 s of
  `canaries.unit.test.ts`. It compiles the whole corpus once for each of 23 canaries. The tests of
  `scripts/measure.ts` on real commands took 35 s in one file, mostly sleeps and 1 Hz sampling.
- In `ssr:*`, `ssr:angular` took 40 s and each other target 6 to 10 s. ADR-0024 decision 5 runs
  `harness/ssr.test.ts` once per project. Splitting Angular's file alone gained nothing, because
  every ngtsc compile went through one queue per plugin and one worker thread per process
  (`ngtsc-virtual.ts`, ADR-0027).

CI's job queue is what limits it there, so the time must come from parallel workers inside
the current jobs, not from more jobs or more projects.

## Decision

- **Shard files.** A slow file becomes a module and shard files. Each shard file is one call with
  its index: `describeCorpusShard(k)` in `harness/canaries-corpus.<k>.unit.test.ts`, and
  `describeSsrShard(k)` in `harness/ssr.<k>.test.ts`. A shard takes its share of one list by
  position, modulo the count (`shardOf`, `harness/shards.ts`), so a new canary or case lands in
  exactly one shard. The test titles do not change, so a run's test names, projects and matrix
  cells stay the same.
- **Counts.** `SHARDS` and `SSR_SHARDS` in `harness/shards.ts` hold them: 4 corpus shards, and 4
  ssr shards for Angular and 1 for every other target. An ssr project runs the first files its
  count names and provides the count as `ufSsrShards`. A project the run adds as a case's own
  reference (ADR-0057) runs one. `shards.unit.test.ts` fails when the files on disk differ from
  the counts, when a file calls another index, or when a shard would hold no test.
- **The L14 throws block** (ADR-0078) is registered only in the shards that hold such a case. When
  no case of the project has one, every shard keeps the empty block and fails, as the one file did.
- **The measure tests** run in three files, `measure-report`, `measure-tree` and
  `measure-interrupt.unit.test.ts`, which share `harness/measure-script.ts`. Each file writes a
  report under its own label, so files that run at once never read or delete each other's.
- **The ngtsc pool** (amends ADR-0027). `ngtscVirtual` compiles in a pool of worker threads
  (`compilePool`) of at most `poolSize()` threads: one, or two on a machine with four cores or
  more. A thread starts only when every thread alive is busy. A compile goes to the first idle
  thread, or a new one, or the one with the fewest compiles waiting. Each thread keeps its own
  previous program per plugin, so reuse stays sequential within a thread, and a released plugin
  goes to every thread. A thread that dies or exits fails only its own compiles. The per-plugin
  queue is gone, since each module's sources are collected after its children have loaded.

## Consequences

**Positive:**

- The two projects take half the time (medians of alternating warm runs, the base `B` against the
  head `H`, `wallSeconds` and `peakRssGib` from `scripts/measure.ts`, load average 5 to 46):

  | Command (`--project`) | Runs | B median | H median | H / B | Peak RSS, B → H |
  | --------------------- | ---- | -------- | -------- | ----- | --------------- |
  | `harness`             | 3    | 49.3 s   | 25.2 s   | 0.51  | 4.05 → 6.12 GiB |
  | `ssr:*`               | 5    | 63.7 s   | 29.6 s   | 0.46  | 3.95 → 5.16 GiB |

- `browser:angular` compiles through the same plugin, so its compiles also run two at once.

**Negative:**

- Peak summed RSS rises by about a third on `ssr:*`, from more Vitest workers and the second ngtsc
  worker, which holds about 400 MB. Four ssr shards for every target kept 13 workers alive and
  reached 1.66 times the base. Three or four ngtsc workers reached 1.65 times, with no time the
  loaded machine could tell apart from two.
- The measure tests' sampling flakes under load on both sides, and three files running at once add
  to the load.
- Each corpus shard compiles the clean corpus for itself, so the block costs more CPU in total.

**Open:**

- CI runners have fewer cores, so their gain is smaller. Their times are reported on the pull
  request, with no target.

## Alternatives considered

- **Several `ssr:<target>:<k>` projects.** They change the project names that the parity matrix,
  `projectNames`, CI's `parity` job and the summary read.
- **Preloading every component in one `beforeAll`.** It moves each case's transform failure out of
  its own test.
- **Shards without the pool.** Angular in one, two and four files with one worker took 39, 38.5
  and 45 s when this was planned.
