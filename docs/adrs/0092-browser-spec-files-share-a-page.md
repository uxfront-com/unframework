# ADR-0092: Browser spec files share a page, but on Vue

- **Status:** Accepted
- **Date:** 2026-11-12
- **Plan:** §7.3, §7.6, P2; ADR-0018, ADR-0061, ADR-0078, ADR-0081, ADR-0083, ADR-0091

## Context

The `browser:<target>` projects run the 212 spec files of the corpus on every target, 1,484 files
in a full `browser:*` run. Vitest gave each file a fresh tester frame (`isolate: true`, its
default), so every file loaded the testing setup, the framework's runtime and the styling
engines' modules again before its first test. ADR-0083 keeps these layers on Vitest, so the cost
has to come down inside Vitest.

Vitest's own summary looked like it settled the question: `worker 93%, tests 7%` for
`browser:vue`. That figure isn't the set-up cost. In browser mode Vitest takes the tester frame's
`performance.now()` from a start time the orchestrator page read on its own clock (`prepare` in
`@vitest/browser` 5.0.3), so the "worker" phase grows with how long the orchestrator page has been
open. Summed per file, the tests themselves take 365 s of the 12 tester pages' time in a
`browser:vue` run of about 35 s, which is most of the run.

What the fresh frame does cost is work in Vitest's main process and in Chromium, and that work
counts when several projects run at once. On an Apple M4 Max (14 cores, 36 GB, Node 26.13.1), at
`f09c5ce1`, three warm full `browser:*` runs of each, interleaved, gave these figures. Other runs
shared the machine, so each row gives the load average when it started:

| Full `browser:*` run, warm | Load average | Wall time | CPU time | Peak memory (summed RSS) |
| -------------------------- | ------------ | --------- | -------- | ------------------------ |
| Fresh frames, run 1        | 15.95        | 178.9 s   | 1,034 s  | 28.1 GiB                 |
| Fresh frames, run 2        | 11.26        | 185.6 s   | 1,057 s  | 27.7 GiB                 |
| Fresh frames, run 3        | 9.76         | 174.0 s   | 1,002 s  | 27.4 GiB                 |
| Shared pages, run 1        | 11.70        | 130.8 s   | 567 s    | 27.1 GiB                 |
| Shared pages, run 2        | 11.04        | 134.8 s   | 576 s    | 25.6 GiB                 |
| Shared pages, run 3        | 24.37        | 130.9 s   | 559 s    | 27.1 GiB                 |

The median wall time falls from 178.9 s to 130.9 s, by 26.8 %, and the CPU time by about 45 %.

That left `browser:vue` on the critical path. In a live run it is the reference and runs alone,
first, while the six followers wait for it (`groupOrder`, ADR-0018). Its files keep a fresh frame
each and mostly wait on the browser, so it gains from more pages: alone, it took 33.8 s with 12
pages, 23.8 s with 21, 20.5 s with 28 and 22.5 s with 35. With 28 pages for `browser:vue` (two per
CPU) and the default for the followers, a second session at `64f11547` gave:

| Full `browser:*` run, warm             | Load average | Wall time | Peak memory (summed RSS) |
| -------------------------------------- | ------------ | --------- | ------------------------ |
| Fresh frames, run 1                    | 13.66        | 200.0 s   | 24.8 GiB                 |
| Fresh frames, run 2                    | 15.01        | 184.6 s   | 26.3 GiB                 |
| Fresh frames, run 3                    | 13.45        | 202.6 s   | 18.9 GiB                 |
| Shared pages, more for the reference 1 | 14.95        | 128.0 s   | 29.0 GiB                 |
| Shared pages, more for the reference 2 | 21.79        | 144.8 s   | 24.5 GiB                 |
| Shared pages, more for the reference 3 | 12.54        | 117.2 s   | 30.3 GiB                 |

The median falls from 200.0 s to 128.0 s, by 36.0 %. A last run on the final head, at a load of
4.46, took 113.4 s with a peak of 28.2 GiB. The median peak rises from 24.8 to 29.0 GiB, because
Vitest keeps each project's browser open until the run ends, so Vue's extra pages stay alive while
the followers run. Every run completed under the 32 GiB ceiling of `scripts/measure.ts`, which one
run with fresh frames crossed at 32.2 GiB in another session.

On macOS a follower needs `browser:vue` in the same run (its L10 compares with Vue's live
captures), so each follower was timed beside it, once each: with fresh frames at `f09c5ce1`, with
shared pages at the same commit, and on the final head `ee277c2b`, where `browser:vue` runs with 28
pages in both kinds of run:

| Projects                            | Fresh frames | Shared pages | Final head |
| ----------------------------------- | ------------ | ------------ | ---------- |
| `browser:vue`                       | 33.4 s       | 34.0 s       | 20.1 s     |
| `browser:vue` and `browser:react`   | 65.4 s       | 61.6 s       | 48.2 s     |
| `browser:vue` and `browser:svelte`  | 64.9 s       | 61.4 s       | 47.9 s     |
| `browser:vue` and `browser:solid`   | 64.5 s       | 61.7 s       | 48.7 s     |
| `browser:vue` and `browser:angular` | 73.8 s       | 71.9 s       | 74.5 s     |
| `browser:vue` and `browser:qwik`    | 64.3 s       | 61.3 s       | 59.2 s     |
| `browser:vue` and `browser:astro`   | 43.8 s       | 41.1 s       | 35.8 s     |

Sharing a page exposed one leak. Vue's development build rethrows an error that a lifecycle hook
throws (`logError`), out of `flushPostFlushCbs`, which leaves its `activePostFlushCbs` set. From
then on, Vue adds every post-flush callback to that stale queue and never runs it, so no later
component's `onMounted` runs on that page.

`sourcemaps/mounted-throws` throws in `onMounted` on purpose (L14, ADR-0078), and every Vue spec
file after it on the same page failed. No other target leaked: in five full runs with every project
on shared pages, every failure was Vue's, or a follower's L10 that missed the reference capture Vue
never made.

## Decision

- Every browser project runs its spec files one after another on each of its tester pages, which
  keep their modules (`isolate: false`). The testing setup file still runs for every spec file,
  so its hooks, its startup check and its "spec finished" report (ADR-0091) are each file's own.
- `browser:vue` keeps a fresh frame for every spec file, since its runtime can't recover on a page
  where a hook threw. `FRESH_PAGE_PER_FILE` in `harness/projects.ts` names each target that keeps
  one, with the reason. A target joins it only with a leak that its runtime can't undo.
- The setup checks the browser context for every spec file, in the file's own colour scheme
  (`prepareSpecFile`), and installs the bundled font and the reset once per page. The bound on
  `expect.element` wraps it once per page.
- A console message that a spec file's page logs after its last judgement, before the next file
  starts, is judged with the next file's first test, and its failure names the case it followed.
- `browser:vue` opens two tester pages per CPU (`REFERENCE_PAGES_PER_CPU`) when no other project
  the run selects shares its `sequence.groupOrder` group, which in practice is a live `browser:*`
  run or `browser:vue` alone (`referencePages` in `harness/projects.ts`). Vitest refuses two
  `maxWorkers` in one group, so a full run, CI's baseline mode and Firefox and WebKit keep
  Vitest's default. So do an update run, which writes artefacts, and a caller's `--maxWorkers` or
  `VITEST_MAX_WORKERS`.
- Every other project keeps Vitest's default page count. With shared pages, 14 pages a project took
  129.4 s, no faster than 12, and 16 took 123.3 s at a peak of 31.9 GiB. 24 went over the 32 GiB
  ceiling.
- Firefox and WebKit share pages too, and still run one spec file at a time (ADR-0081).

## Consequences

**Positive:**

- A full `browser:*` run takes about a third less time and half the CPU work, and each follower
  loads its framework once per page, not once per file.
- The parity matrix is unchanged: `scripts/matrix-diff.ts` found 0 of 9,048 cells different
  between fresh frames and each of the three runs with shared pages above, and each of four
  earlier runs at `ee74571d`, two of them with 16 pages a project.

**Negative:**

- A state that one spec file leaves on a page can now reach the next file on that page. The setup
  resets what it knows about: the mounted views, the mouse, the keys, the focus, the clock, the
  colour scheme and the console. A leak it doesn't know about shows as a follower that differs from
  Vue, which still runs every file on a fresh frame, or as a Linux baseline that no longer matches
  in CI.
- What a case leaves in the document head stays there: its scoped sheet, which matches only its
  own components, and the styling engines' sheets, which are the same for every case. The one
  `:global()` rule in the corpus (`styles/global`) styles `.uf-highlight`, which no other case uses.
  A new global rule needs the same check.
- The peak memory of a full `browser:*` run is higher: a median of 29.0 GiB against 24.8 GiB, and
  30.3 GiB at most, which leaves under 2 GiB below the 32 GiB ceiling. A full `pnpm test`, an
  update run and CI don't change.
- Vue's page count stops at 28 (`MAX_REFERENCE_PAGES`), the count measured best on 14 CPUs. Vitest
  caps the followers' default at 12 pages, so without a limit a machine with 32 hardware threads
  would give Vue 64. A machine much larger or smaller than the one measured may want another count.

**Open:**

- Firefox and WebKit haven't run on shared pages yet: the nightly workflow is their first run.

## Alternatives considered

- **Fresh frames everywhere, and more tester pages.** With fresh frames, 16 pages a project took
  208 s, as long as 12, because each page still loaded every file's modules.
- **An `app.config.errorHandler` in Vue's mount adapter, so a hook's error doesn't unwind Vue's
  queue.** It would change how a Vue error reaches the test: an error in a watcher would no longer
  reject the adapter's `settle()`, so the test that caused it could pass while the run fails with
  an unhandled error. That weakens L8, and the corpus checks Vue as its development build behaves.
- **Grouping the cases into fewer files.** It changes the corpus layout that ADR-0018 records and
  the per-case "spec finished" report of ADR-0091, and sharing pages takes away the cost it would
  save.
