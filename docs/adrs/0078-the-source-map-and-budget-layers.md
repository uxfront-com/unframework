# ADR-0078: L14 checks source maps and L15 checks budgets

- **Status:** Proposed
- **Date:** 2026-11-05
- **Plan:** §7.2 (L14, L15), §7.9, §9 M6; P1, P2; ADR-0024, ADR-0027, ADR-0074, ADR-0075

## Context

Plan §7.2 makes L14 (positions round-trip to `.uf.tsx`, and a thrown error's stack points at the
authored line) and L15 (compile time per case, and output size per target with the framework
externalised, stay within budget) live from M6. `LIVE_LAYERS` stops at L13 today, and
`packages/testing/src/layers.ts` already names both. M6's exit says a runtime error's stack trace
maps to `.uf.tsx` on every target. Three facts shape the layers:

- **The runners are noisy.** An absolute time budget would fail on a slow machine, not on a slow
  compiler.
- **The default run stays short.** Timed iterations don't belong in `pnpm test`.
- **CI's parity job requires every (case, target, live layer) cell,** so a case that throws still has
  to render cleanly for the other layers.

This record is proposed before M6 builds it. Each section below is amended in place as its part is
built.

## Decision

### Budgets

- `tests/integration/scripts/budgets.ts` measures with tinybench:
  - **Compile time per case,** on all seven targets with formatting: 20 iterations after a warm-up,
    the median, normalised by `basics/hello` on the same machine.
  - **Output size per target:** each target's L3 compile, then a minified rolldown bundle with the
    framework, `.css` and `passThrough` imports external. It records raw and gzip bytes.
  - **The clock** is the main thread's CPU time, through tinybench's `now`. The clock on the wall
    charges a compile for whatever else the machine runs. The process's CPU time charges it for V8's
    background GC and JIT, which made `types/imported-interface` fail on a quiet machine. The cost is
    that oxfmt formats on a native thread, so a time counts almost none of the formatter's work. The
    compile still formats, and oxfmt is pinned exactly, so only a deliberate bump can change that cost.
  - **The calibration** runs before each case, and a ratio divides by the median of those runs, since
    `basics/hello` is the shortest compile of all and one run alone is noisy. Its own ratio is 1 by
    definition.
  - **The framework compile** is a new toolchain method, `frameworkEmit`, because L3's
    `frameworkCompile` keeps only errors and warnings. It compiles for a production client build, so
    a size counts what ships: Vue with its template inlined, Qwik in production mode with its
    segments, Angular AOT only. It's one more compile beside L3's, not L3's own.
  - **A bundle's entries** are every output file of the case on that target, and its size is the sum
    of its chunks, so Qwik's lazy segments count. It defines `process.env.NODE_ENV` as `"production"`
    and `ngDevMode` as `false`.
- `pnpm test:budgets:update` writes `tests/integration/budgets.json`, a generated file that's never
  edited by hand. Each budget is the measured baseline: its time rounded up to two decimals, and its
  sizes as measured. A case with output on no target has no budget, since it has no cell to fail.
- A size fails above its budget plus 5%, and a time above twice its budget. A time fails every cell of
  its case that has output.
- It runs in a new `bench` project, which only `--project bench` selects, by that exact name. A run
  without that project in full reports L15 as `skip(not in this run)`, never as missing.
  `pnpm --filter @unframework/integration budgets`, `pnpm test:canaries L15` and a `Bench` CI job,
  which isn't required, all run it. CI's parity job reads the `Bench` report and requires every cell.
- Two canaries break a budget and have to fail the layer, one per check: `L15-output-bloat` grows every
  file, and `L15-slow-compile` slows the compile of one case, since each of its iterations waits.

### Round trip

- The `compile` project compiles with `sourceMap: true`, so L2's determinism check holds the maps too.
  For every case and target, `sourceMapProblems` (`harness/compile-checks.ts`) checks that:
  - each output's map decodes and stays inside its two files
  - `sources` names the case's `.uf.tsx`, relative to the output, with its content
  - each segment without a name maps to identical source text, read for the length of the source's
    token (ADR-0074). A segment with a name marks a reference, which a target respells, so only its
    position is checked
  - a shared module's copy names itself, and a scoped sheet's map has no segments
- It records L14 per cell, and a case with compile errors on a target has no output, so that cell is
  a skip.
- A token oxfmt rewrites needs no allowance here. Formatting drops a segment whose token it changes,
  so no segment that compares text is left to excuse (ADR-0074).
- L14 passes a map with no segments, as a template of only static markup has. A corpus gate in the
  same project fails a target none of whose maps compare any text.
- `L14-map-shifted` moves one segment of a compiled map a column along, through a new `map` corruption
  point, since the `output` hook runs before the map exists. It picks a segment whose text changes
  when shifted, because `=` beside `=` reads the same. A few cells, mostly Angular's markup and static
  templates, have no segment that compares text, so there the canary adds one that reads the wrong
  text. A canary has to reach every case it's judged on.

### Thrown errors

- Three cases, `tests/integration/cases/sourcemaps/{handler-throws,computed-throws,mounted-throws}`,
  each throw an error from one line. `throwSite` (`harness/thrown.ts`) finds that line by locating
  `throw` in the case's `.uf.tsx` sources, and refuses a case with none or several, so no test holds
  a number.
- Each case renders cleanly for the other layers. The throw fires only in the L14 check, on a
  scripted step, through `view.expectThrown(() => view.user.click(…))`, L14 in `BROWSER_LAYERS` and no
  branch on the target. The first test of a case renders it, and the second, which requires
  `interactivity`, throws.
- `view.expectThrown` captures the first `Error`: what reaches `window`'s `error` or
  `unhandledrejection`, or rejects the step, comes before what the console is given. Vitest logs a
  window error as a new `Error` of its own, so a logged one only counts for a framework that logs and
  nothing else. Its listeners also stop Vitest from failing the run on the deliberate throw.
- L13 excuses what the console logged during that one step, and no other. A pattern wouldn't do,
  because each framework reports a throw in its own words and an allowance holds for the rest of the
  test. The step leaves no trace step for L9, because what a framework leaves behind after a throw
  isn't a contract.
- The `ufMapStack` command takes the top frame inside the case, finds its module in the browser's
  Vite module graph and traces it through `transformResult.map` with `originalPositionFor`. It must
  land on `<File>.uf.tsx:<line>`.
- The `ssr:*` projects render `case.json`'s `ssrThrows` props, which only `computed-throws` declares,
  and check that the top frame of the module runner's `error.stack` is on the `throw`. The first
  `Error` counts here too, since Angular's renderer logs it and resolves.
- Astro has no client code, so it checks only that server render. Its browser tests that throw are
  skipped by capability.
- The spike found what ADR-0074's chain needed on Svelte, Qwik and Astro. No target has a quarantine
  entry for L14.

## Consequences

**Positive:**

- Map corruption fails in the fastest project, `compile`, on every case.
- A budget regression is a red job with its case and target, not a slow drift nobody sees.
- A time normalised by `basics/hello` follows the case more than the runner.

**Negative:**

- Budgets are the measured baseline plus a margin, so they stop regressions and say nothing about
  whether the baseline is good.
- `bench` is a new `ProjectKind`, so `harness/projects.ts`, `scripts/canaries.ts` and the parity job's
  `needs` all have to know it.
- Adding a case changes `budgets.json`, so such a change re-runs the update.
- The thrown-error check reads a browser project's module graph, which ties it to Vite's.

## Alternatives considered

- **An absolute time budget.** It would measure the runner as much as the compiler.
- **Running budgets in the default run.** Twenty iterations per case on seven targets would slow every
  `pnpm test`.
- **Checking a sample of cases.** Every other live layer covers every case and target (P1), and a
  sample would leave cells undefined.
- **A quarantine entry for a target whose chain fails.** It would hide the exit criterion for that
  target. The chain goes back to planning with its evidence.
