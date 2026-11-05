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
  - **The clock** is the process's CPU time, through tinybench's `now`, because the clock on the wall
    charges a compile for whatever else the machine runs.
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

- The `compile` project compiles with `sourceMap: true`. For every case and target it checks that:
  - each output's map decodes
  - `sources` names the case's `.uf.tsx`, with its content
  - each anchored run maps back to identical source text
- It records L14 per cell.
- A canary shifts one segment of a compiled map, through a new `map` corruption point, since the
  `output` hook runs before the map exists.

### Thrown errors

- Three new cases, `tests/integration/cases/sourcemaps/{handler-throws,computed-throws,mounted-throws}`,
  each throw an error. The expected line comes from locating `throw` in the source, never from a
  number in the test.
- Each case renders cleanly for the other layers. The throw fires only in the L14 check, on a
  scripted step (`view.user`), through L14 in `BROWSER_LAYERS` and a wrapper around the step that
  never branches on the target.
- The browser projects capture the first `Error`, and L13 allowlists it with a reason.
- A browser command maps each frame on the browser's Vite server, from the module graph's
  `transformResult.map`, with `originalPositionFor`. The top user frame must be
  `<Case>.uf.tsx:<line>`.
- The `ssr:*` projects assert the module runner's mapped `error.stack`.
- Astro is static, so it runs `computed-throws` only, through a dedicated SSR render with a prop that
  throws.
- Qwik's optimizer segments and Astro's compiler maps get a spike first. A chain that can't reach the
  source is reported with its evidence, and it never gets a quarantine entry.

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
