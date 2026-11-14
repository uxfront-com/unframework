# ADR-0106: The hydrate projects share their pages

- **Status:** Accepted
- **Date:** 2026-11-15
- **Plan:** §7.2 L12, §7.3, P2; ADR-0018, ADR-0078, ADR-0092, ADR-0095; amends ADR-0092 (a
  target's fresh page per spec file applies to its browser project only) and ADR-0095 (the
  hydrate projects don't take the browser projects' isolation)

## Context

ADR-0095 builds each `hydrate:<target>` project from the same page project as `browser:<target>`,
so `hydrate:vue` took the fresh frame per spec file that ADR-0092 gives Vue (`isolate: true`).

A run filtered with `-t` failed on `hydrate:vue` and nowhere else. A step of a test that the filter
kept, like `locator.ariaSnapshot` or `locator.hover`, passed the 5 s action timeout after its
locator had resolved. The same cases passed when run by path, and in a full run. On an Apple M4 Max
(14 cores, Node 26.13.1), at `836a6a00`:

| Run                                   | Runs | Failed |
| ------------------------------------- | ---- | ------ |
| `--project 'hydrate:*' -t 'events/'`  | 9    | 3      |
| `--project 'hydrate:*' -t 'teleport'` | 6    | 6      |
| `--project hydrate:vue cases/events`  | 4    | 0      |
| `--project 'hydrate:*'`, with no `-t` | 1    | 0      |

A `-t` run still loads every spec file to collect its tests, and skips the ones that don't match.
On a page that keeps its modules, a skipped file costs one import. On `hydrate:vue`, each skipped
file is a fresh frame that loads the testing setup, the hydrate adapter, Vue and the case again.
With `DEBUG=vite:time`, a `-t 'events/'` run of `hydrate:vue` serves 23,019 module requests to its
227 frames, 74 of them per frame from the testing package's sources, which Vite serves one by one.
Vitest's main process serves them while the 18 files the filter keeps run on the same 12 pages.

The stall is load, not one slow call. Each step of an L12 test is many short round trips: the page,
a Vitest command, Playwright, Chromium and back. Timed inside `harness/hydrate.ts`, the server
render took a median 1 ms and 98 ms at most. Only 2 of 5,109 Playwright calls took over 0.8 s,
Vitest's event loop never stalled for over 1.2 s, and the machine was half idle. The round trips
fell behind while the main process handled about 24 s of module requests in a 13 s run, until
one step passed 5 s. The test that failed first takes 1.5 s when nothing stalls, and took up to
19.8 s in a filtered run.

It depends on how the frames overlap the kept tests, so a page count doesn't fix it. With 1, 3, 6
or 28 pages the same run passed, and with Vitest's default of 12 it failed. A count that works here
moves with the machine and the corpus.

ADR-0092 kept Vue's fresh frames for two reasons. Vue's development build can't recover on a page
where a lifecycle hook threw, and `sourcemaps/mounted-throws` throws in `onMounted` on purpose (L14,
ADR-0078). And `browser:vue` is the reference, whose fresh frames show a leak in a follower. Only
the first applies to `hydrate:vue`: it compares with the shared expectations, writes nothing and is
no project's reference (ADR-0095).

## Decision

- **Every hydrate project shares its pages** (`isolate: false`), on every target.
  `isolatesFiles(kind, target)` in `harness/projects.ts` is true only for a browser project of a
  target in `FRESH_PAGE_PER_FILE`, so `browser:vue` keeps its fresh frames.
- **The case that leaves a page unusable runs last in its hydrate project.**
  `LEAVES_PAGE_UNUSABLE` in `harness/projects.ts` names one case per target, with the reason. For
  Vue it is `sourcemaps/mounted-throws`. The harness's sequencer (`harness/sequencer.ts`, set as
  `sequence.sequencer` in `vitest.config.ts`) takes Vitest's `BaseSequencer` order and moves that
  case's spec file after every other file of the target's hydrate project. Nothing else moves.
- **A listed case must exist.** The sequencer throws when a listed case isn't in the corpus or has
  no spec, so the list can't silently keep nothing last.
- **One case per target at most.** Two such files could still meet on one page, since each page
  runs the files it takes one after another. A second case for one target needs another design.

## Consequences

**Positive:**

- A filtered `hydrate:*` run is stable. At this record's head, `-t 'events/'` and `-t 'teleport'`
  passed 20 of 20 runs, and the filtered `hydrate:vue` run serves 2,582 module requests, not
  23,019.
- The parity matrix doesn't change: `scripts/matrix-diff.ts` found 0 of 1,589 cells different
  between full `hydrate:*` runs before and after.
- A full `hydrate:vue` run loads Vue once per page, not once per file.

**Negative:**

- A state that one spec file leaves on a hydrate page can reach the next file there, as on the
  follower browser projects (ADR-0092). It shows as an L12 failure against the shared expectations,
  since `browser:vue` still renders every case on a fresh frame.
- "Last in the project" relies on Vitest 5.0.3's browser pool: each page takes the next file from
  the project's one queue, in the sequencer's order, so no file starts after the last one. A Vitest
  that changes this fails loudly: without the sequencer, a full `hydrate:vue` run failed 19 tests
  in 14 files, all after `sourcemaps/mounted-throws`.

**Open:**

- Why `browser:vue` stays fast under the same churn at 12 pages: a filtered run passed 3 of 3, its
  slowest test taking 1.9 s. It keeps its fresh frames, so this decision doesn't depend on the
  answer, but a filtered `browser:vue` run that stalls would have the same cause.

## Alternatives considered

- **Vitest's `--experimental.preParse`,** which drops files that can't match `-t` before loading
  them. It found no test names, since `describeTargets` builds them at run time, so it dropped
  every file.
- **A page count for filtered runs.** The stall depends on how the fresh frames overlap the kept
  tests, which moves with the machine and the corpus.
- **An `app.config.errorHandler` in Vue's adapter,** so the hook's error doesn't break the page.
  ADR-0092 rejected it because it weakens L8.
- **A longer action timeout.** It hides the stall without removing its cause, and a slower machine
  would pass it again.
