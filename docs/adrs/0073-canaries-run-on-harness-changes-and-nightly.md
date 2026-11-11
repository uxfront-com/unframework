# ADR-0073: Canaries run on harness changes and nightly

- **Status:** Accepted, amended by ADR-0084
- **Date:** 2026-11-06
- **Plan:** §7.7, §7.9; P2; ADR-0043, ADR-0052, ADR-0066; amends ADR-0043 and ADR-0052

## Context

ADR-0043 runs the canaries in CI as a matrix on every pull request, and ADR-0052 splits a canary
whose browser specs run into shards. The matrix now has 27 of CI's jobs, and each takes minutes.
A canary proves that a layer catches a corruption. Most pull requests can't change that answer,
because they change neither the harness nor what the canary judges.

A workflow's `paths` filter can't do this: it applies to the whole workflow, and a filtered
workflow leaves its required checks pending.

## Decision

- **A `changes` job in `ci.yml` decides.** On a pull request, it diffs the merge commit against its
  first parent, with `--no-renames`, and pipes the names to `tests/integration/scripts/canary-paths.ts`,
  which prints `canaries=true` or `canaries=false`. The `canaries` job needs it, and runs only on
  `true`. A skipped job counts as passed. A push to `main` and `workflow_dispatch` always give
  `true`, with no diff.
- **The list is `CANARY_PATHS` in that script.** It holds what a canary's verdict depends on: the
  workflow that runs them, the harness and the files at its package's root, the corpus specs and
  each `case.json`, `packages/testing`, `packages/compiler` and `packages/unplugin`, the toolchains
  that run L3 to L5, the root manifest that holds `test:canaries`, and the `catalog:` and lockfile that
  pin Vitest and Playwright. Golden outputs, expectations, baselines and case sources stay out: the
  harness's unit tests, which run on every pull request, run the corruptions on every case they
  apply to and check that the output changes.
- **A failure is loud (P2).** The step sets `shell: bash`, whose pipefail turns a failed diff or
  script into a red job, so a failure never passes as a skip.
- **`nightly.yml` runs every canary**, in Chromium, with the same `include` list and run line as
  `ci.yml`. `canaries.unit.test.ts` fails when the two differ, or when the `needs` and `if` wiring
  is missing.

This amends ADR-0043, whose matrix runs on every pull request, and ADR-0052, whose shards now run
on a pull request only when the list says so. The shards themselves don't change.

## Consequences

**Positive:**

- A pull request that changes only emit code, the analyser or their tests runs no canary job.
- A change to the harness runs them, with nothing to remember.

**Negative:**

- The accepted risk: a change to a compile package the list leaves out (`packages/ir`, `parser`,
  `diagnostics`, `analyzer`, `type-oracle`, `type-oracle-tsgo`, `codegen` apart from its toolchain
  files, `target-*` apart from theirs, and `unframework`) can change a canary's answer, most plainly
  a target-specific one such as `L13-qwik-handler-throws`. The unfiltered harness unit tests and the
  nightly run are the backstop, so such a change can reach `main` before a canary reports it.
- The matrix is written twice, and a test holds the copies together.
- A pull request that adds a corpus spec still runs the canaries, since a canary judges that spec.

## Alternatives considered

- **A workflow-level `paths` filter.** It leaves required checks pending.
- **A reusable workflow for the matrix.** It removes the copy, but moves the matrix that the
  harness's tests read out of `ci.yml`. The copy and a test are the smaller change.
- **A third-party path filter action, or a diff through the API.** Both add a dependency or a token
  for what `git diff` on the merge commit answers.
- **A shorter list: the harness, `packages/testing`, the scripts and the workflow.** It leaves out
  the corpus specs and the toolchains, which a canary's verdict reads, so a change to them would
  skip the canaries that judge it.
