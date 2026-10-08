# ADR-0052: A canary whose browser specs run is sharded by case in CI

- **Status:** Accepted
- **Date:** 2026-10-08
- **Plan:** §7.7, §7.9, §9 M2; P2; ADR-0043, ADR-0050; amends ADR-0043

## Context

ADR-0043 runs the canaries in CI as a matrix, with at most one browser canary in each job, and
each job inside the ten-minute budget of §7.9. It left open "a shard of a browser canary's job,
once the corpus outgrows the ten minutes", and ADR-0050 left open whether those jobs need "a
target dimension or shards".

M2's corpus has outgrown it. Its 109 specs hold 349 tests on each target. On the first CI run of
M2, `L8-render-nothing` and `L10-root-hidden` were cancelled at the ten minutes, and the other
browser canaries took between 6.5 and 9 minutes.

A corrupted spec fails because it waits out a timeout: the poll's 5 s or Playwright's 5 s action
timeout. Vitest's browser pool runs each project on `availableParallelism() - 1` pages, at most
12, and runs the projects side by side. CI's runner has 4 vCPUs, which gives 3 pages a project.
Under L8, every test of a project waits about 5 s, so each project takes about
349 × 5.3 s / 3 ≈ 10 minutes. That time does not depend on how many targets the job runs, so a
target dimension cannot bring it down. Only fewer tests a project can.

## Decision

- **`pnpm test:canaries` takes `--shard <index>/<count>`.** A shard holds every `count`th case of
  the corpus, in its order, from the `index`th. Shards 1 to `count` hold each case once, and they
  share each area's cases, so the diagnostics cases, which have no spec, do not all go to one
  shard.
- **A shard's run filters Vitest to its cases.** The script passes the specs of the shard's cases
  as file filters, so the browser projects run those specs alone. It also passes `harness/`, so
  every other project runs whole: each of those runs one harness file over the corpus. The same
  filter keeps `harness/unavailable.test.ts`, which fails a project whose toolchain cannot load.
- **The verdict judges every kind of project on the shard's cases alone.** Shards 1 to `count`
  together judge each case on every target once. Within a shard, a case that records nothing is
  still the blind spot that the verdict reports.
- **In CI, a canary whose browser specs run is sharded.** Each canary with browser evidence (its
  tests run) runs in two shards, one job each. The other canaries run in one job each. That
  includes `L6-golden-guard`, whose specs fail to load, so they run no test and wait for nothing.
  The matrix is a list of `include` entries: `canaries`, and `shard` where the canary is sharded.
  `canaries.unit.test.ts` holds the matrix to every canary, once or in shards 1 to n, to at most
  one browser canary a job, and to shards for each canary whose browser specs run.
- **When a shard nears the ten minutes, the count goes up.** The job's timeout stays.

## Consequences

**Positive:**

- A sharded job runs half of the tests: `L8-render-nothing` on React took 81.3 s locally for
  shard 1/2, against 159.6 s for the whole corpus.
- The count grows with the corpus. The harness and the verdict do not change.
- Each case is still judged on every target, by its own layer, in exactly one shard.

**Negative:**

- The matrix has nine more jobs, and each job installs the workspace again (about a minute).
- One job proves only its shard. A canary is caught when all of its shards pass. A local
  `pnpm test:canaries` without `--shard` still runs the whole corpus.
- The projects that a shard runs whole repeat in each shard, for example the ssr projects of
  `L13-console-warn`. They are judged on the shard's cases alone.

## Alternatives considered

- **A target dimension (`UF_TARGETS` per job).** It cuts the CPU work of a job. But under L8 each
  project waits about 10 minutes on its 3 pages, with any number of targets. Locally, React alone
  took 159.6 s, and all seven targets took 335.1 s.
- **Vitest's own `--shard`.** Vitest splits files by a hash of their paths. The verdict could then
  not tell a case that another shard holds from one that recorded nothing, which is the blind
  spot it exists to report.
- **More pages a project under a canary (`maxWorkers`).** This shortens the waits. But the canaries
  that do real work, such as `L10-root-inverted`'s pixels and `L13-console-warn`'s full specs,
  would share 4 vCPUs among more pages. A capture that times out under load would then miss its
  evidence.
- **Shorter timeouts under a canary.** The canary would then prove a harness that CI does not run.
- **A longer job timeout.** §7.9 sets a budget, and the time grows with the corpus.

## Evidence

- CI run 37676519985 on `alexgrozav/milestone-m2-implementation`: `Canaries (L8)` and
  `Canaries (L10-root-hidden)` were cancelled at 10 minutes. The job times were
  `L10-root-inverted` 8:55, `L9-unwired-handler` 8:30, `L13-console-warn` 8:28,
  `L9-rerender-text` 7:10, `L11` 7:04, `L7` 6:40 and `L13-qwik-handler-throws` 6:35.
- Locally, on an Apple M4 Max with 14 cores (12 pages a project): `L8-render-nothing` failed 2244
  tests on seven targets in 335.1 s. The median test took 5299 ms (p10 5133 ms, p90 5599 ms). On
  React alone it took 159.6 s, and with `--shard 1/2` 81.3 s, caught on every case of the shard.
- Vitest 5.0.3's browser pool (`createBrowserPool`): `maxThreadsCount = Math.min(12, numCpus - 1)`
  pages for each project, and the projects' pools run in parallel.
- `tests/integration/harness/canaries.unit.test.ts`: "run in CI as a matrix: every canary once or
  in every shard, at most one browser canary per job, and shards for each whose browser specs run",
  "take a shard, and run each case in exactly one of its parts" and "filter a shard's run to its
  cases' specs, and run every other project whole".
