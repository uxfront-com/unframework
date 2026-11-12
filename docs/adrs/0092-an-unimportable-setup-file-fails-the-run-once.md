# ADR-0092: A setup file a project can't import fails the run once

- **Status:** Accepted
- **Date:** 2026-11-12
- **Plan:** §7.4, §7.7, P2; ADR-0018, ADR-0057, ADR-0091

## Context

Every browser project imports two setup files in the page before each spec file: the testing
API's `setup.ts` and its target's own, such as `targets/solid.ts` (`harness/projects.ts`, and
`defineTestConfig` for a project's own tests). When the page can't import one of them,
`@vitest/browser`'s tester throws `Failed to import test file <setup file>`, with the import's own
error as the cause, and none of that spec file's tests run.

Under load, a corpus run once lost every spec file of one browser project that way, with a
`SyntaxError` as the cause, and `unframework visual` lost one cell. Such a spec file records no
cell, so the summary blamed the cases:

- A full run listed `<case> › <target> › L<n>: missing (no test recorded it)` for every browser
  cell of every case of the project, and a scenario difference for each case. Not one of them
  names the setup file or its cause.
- A filtered run listed nothing, and only Vitest's exit code failed it.
- When the project is a case's reference, its spec files never call `ufSpecFinished`, so
  ADR-0091 reported a drop. Its problem quotes the run's errors, and the import's error isn't one
  of them: Vitest reports it on the spec file's module.

The tester wraps a spec file's own import failure in the same message. The golden guard relies on
that: a component whose output differs from its golden file fails its spec's import, and that's
the case's failure. Only the path tells the two apart.

## The cause

Not found yet. Fifteen cold runs of the browser projects, with `node_modules/.vite` deleted and
load averages up to 120, passed every setup import. In 14 of them, a scratch Vite plugin parsed
every JavaScript body the projects' servers sent, and every one parsed. So this record doesn't
fix the cause. It makes the failure name itself when it comes back.

## Decision

- The parity reporter reads each test module's errors. One whose message is `Failed to import
test file <file>`, where `<file>` is one of the project's `setupFiles`, is the harness's
  failure. The reporter keeps it in the partial matrix as `setupFailures`, one entry per project
  and setup file: the target, the setup file relative to the project's root, each spec file with
  its case, and the causes, each with its error's name.
- A spec file's own import failure, and any other error on a module, stays the case's failure.
- The reporter's `collected zero tests` problem leaves out a project none of whose spec files
  could import a setup file. A project with zero tests for any other reason keeps it.
- The summary reports one problem per project and setup file, before every other problem,
  ADR-0091's included, in filtered and full runs alike. It names the project, the setup file, how
  many spec files couldn't import it and the cause Vitest reported.
- For each case whose spec file failed that way, that problem stands in for the project's missing
  browser cells, the case's scenario differences on the project's target (every target's, when
  the target is the case's reference), and `collected zero tests in every shard`, when every run
  that found the project empty also failed its setup import.
- When the project is a case's reference (Vue, or the case's own, ADR-0057), the problem also
  counts the follower cells it left without a comparison at L10, and ADR-0091's problem leaves
  those cases out. The reference's other cases keep ADR-0091's problem.
- Of each spec file, the newest run that recorded its case or failed on it counts, as for a cell.
  A run of a project supersedes the older failures in its scope, as it does the project's cells.
- Every other problem stays, so the run still fails (P2).

In the corpus, where the projects' root is `tests/integration`, the problem reads like this, with
the number of spec files and Vitest's cause filled in:

```text
browser:solid: <n> spec file(s) could not import the setup file ../../packages/testing/src/setup.ts,
so none of their tests ran. This is the harness's failure, not a case's. Vitest reported:
SyntaxError: Unexpected token ')'.
```

## Consequences

**Positive:**

- A setup file a project can't import reads as one problem with its file and its cause, rather
  than hundreds that each name a case.
- A filtered run reports it too, so the run that shows a failure also shows its cause.
- The matrix gets no new cell status, so `MATRIX_VERSION` stays at 5. `setupFailures` is
  optional, as ADR-0091's `errors` is.

**Negative:**

- The run still fails. The summary reports the cause, and doesn't remove it.
- The match reads the message text of Vitest 5.0.3's browser tester. If an upgrade rewords it,
  the run reads as it did before this record. `test/setup-import.test.ts` in the testing package
  imports a setup file that throws, through Vitest and Chromium, so it fails on that upgrade.
- Vitest's Node runner doesn't wrap a failed import, so a Node project's setup file failure reads
  as before.
- The setup file's path is relative to the project's root, so in the corpus it climbs out of
  `tests/integration`.

## Alternatives considered

- **Fold every module that failed before its tests ran.** A spec whose component fails the golden
  guard fails its own import, and that's the case's failure, which the summary names by case.
- **Match the cause, such as a `SyntaxError`.** The cause depends on how the import broke: a
  module that didn't parse, one the page couldn't fetch, or one that threw. The path doesn't.
- **Mark the cells as failed with the cause.** That's a failed cell per case and layer, which is
  the noise this removes.
- **Re-run the spec files that failed.** That's a retry, which §7.7 forbids: it would hide the
  failure rather than report it.
