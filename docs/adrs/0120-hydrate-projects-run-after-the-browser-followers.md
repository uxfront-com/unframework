# ADR-0120: The hydrate projects run after the browser followers

- **Status:** Accepted
- **Date:** 2026-11-22
- **Plan:** §7.2 L12, §7.3, §7.6; ADR-0081, ADR-0092, ADR-0095, ADR-0106; amends no record: no ADR
  says where the hydrate projects run, only `groupOrder`'s doc comment and
  `tests/integration/README.md` did

## Context

A full local run gives each page project its own `sequence.groupOrder` group, and the groups run
one after another (`groupOrder`, `packages/testing/src/node/mode.ts`). With live pixels in
Chromium, `browser:vue` ran first, `browser:react` second, because a case names React as its
reference (ADR-0057), and then one group held the other six browser projects and all eight hydrate
projects. That's 14 page projects at once, with about 12 tester pages each (ADR-0092).

Every browser command of every page project runs in Vitest's main process, on one event loop:
the screenshots, the ARIA snapshots, the clicks and the hydrate projects' server renders
(`ufHydrationRender`). After UXF-896 fixed the font audit, the second test of `directives/rows`
still took about 30 s on each follower in a loaded run, against a 60 s timeout, and 4.6 s when the
follower ran alone beside Vue.

**The load.** A run counted as loaded when it started beside 3 `yes` processes, on a machine whose
1-minute load was 12 or less, with no other `vitest` process. Each ran under `caffeinate -ims`,
and a run whose `kern.waketime` changed didn't count: the daemon Mac went to system sleep inside
three earlier runs, for 2 to 16 minutes each ("Dark Wake Thermal Emergency", "Maintenance Sleep"),
which stretched them to 1,012 to 1,697 s. More `yes` processes didn't make the test slower. With 3,
4, 5 and 6 of them, the slowest follower took 33.1 and 30.2, 32.2, 30.5 and 32.2 s, and the higher
counts only made other files time out. The test is bound by the main thread, which still gets a
core.

**Where the time went.** A CPU profile of the main thread over the followers' rows tests (36.7 s)
found it busy 99 % of the time: Playwright 32.8 %, Vite 19.5 %, native frames 13.6 %, Node core
10.0 %, Vitest 5.1 %, GC 5.0 %. This repository's code was 1.5 % at most (`packages/testing`).
Inside the test, the screenshots grew by 12.3 s, the clicks by 6.9 s and the ARIA snapshots by
3.7 s against the run alone: Playwright round trips through a saturated event loop. The run had
192 tester pages open at its peak.

**The levers.** One loaded full run each, on `ba64fcf1`:

| Run    | Change                                                      | Slowest follower | Wall time    | Failed files           |
| ------ | ----------------------------------------------------------- | ---------------- | ------------ | ---------------------- |
| `main` | none                                                        | 33.1 s, 30.2 s   | 370 s, 342 s | `browser:astro` 20, 10 |
| `H`    | the hydrate projects in a group after the browser followers | 13.0 s           | 332 s        | none                   |
| `P8`   | 8 pages for each page project of the follower group         | 20.6 s           | 343 s        | none                   |
| `P4`   | 4 pages for each                                            | 10.2 s           | 317 s        | none                   |

## Decision

- In a check with live pixels in Chromium, the hydrate projects run in a group of their own, after
  every browser project: `groupOrder` returns `2 + named` for them, where the browser followers
  take `1 + named`.
- The other modes keep their groups. An update run already runs the hydrate projects last, after
  every writer. A check with baselines (CI) runs every project at 0, one project per job. Firefox
  and WebKit run each browser project alone, and the hydrate projects after the last one
  (ADR-0081).
- No page count changes: `referencePages` and Vitest's default for every other project stay as
  ADR-0092 sets them.

## Consequences

**Positive:**

- The followers' browser commands no longer share the main thread with 8 hydrate projects and
  their server renders, so the rows test took 13 s instead of about 30 s, and the full run got
  shorter, not longer.
- In every loaded run with `H`, `P8` or `P4`, `browser:astro` timed out on no file, while every run
  on `main` lost 10 to 261 of its files. Its first render (UXF-916) also waits on this thread.
- CI doesn't change, since each of its jobs runs one project at group 0.

**Negative:**

- A full live run now has one more group. The hydrate projects start only once the slowest browser
  follower has finished, so a slow follower file delays all of L12.
- The page projects in a group still share one event loop. More projects in either group, like
  UXF-857's `vue-vapor`, add to it again.

## Alternatives considered

- **A page budget for the follower group (`P8`, `P4`).** Both worked, and `P4` was 4.6 % faster
  than `H` in one run each. We chose `H` because it changes one group number and no page count:
  Vitest refuses two `maxWorkers` in one group, so a budget has to be one value for all 14 projects,
  derived from the CPU count and the number of projects, and it would need its own exits for update
  runs, CI and `--maxWorkers`. `P4` stays the measured alternative if `H` stops holding.
- **Fewer screenshots or snapshots in the test.** That changes what the test checks, which the
  issue ruled out.
- **A higher timeout or a retry.** That hides the slowdown instead of removing it.
