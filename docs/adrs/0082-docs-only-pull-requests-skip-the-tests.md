# ADR-0082: Docs-only pull requests skip the tests, and pushes run no canary

- **Status:** Accepted
- **Date:** 2026-11-11
- **Plan:** §7.7, §7.9; P2; ADR-0073, ADR-0079; amends ADR-0073

## Context

CI's time goes to the queue, not to the tests. The organisation's GitHub plan runs about 20 jobs at
a time, and a full run of `ci.yml` starts 68. Each job spends about a minute on setup: the
container, Node with the pnpm store, and `pnpm install`. Three things spent most of that queue:

- A pull request that changed only Markdown (docs pages, ADRs, the plan and
  `packages/unplugin/README.md`) ran all 68 jobs in 15 minutes, its last job starting after 11. The
  README sits under `packages/unplugin/**`, an entry of `CANARY_PATHS`, so all 33 canary jobs ran,
  and every test job ran too.
- A push to `main` ran every canary, which `nightly.yml` runs again each night (ADR-0073).
- The seven `E2E (<app>)` jobs each ran 4 to 6 seconds of specs in about 100 seconds. The seven
  `Integration: toolchain (<target>)` jobs each ran 6 to 13 seconds of tests in about 40.

## Decision

- **The `changes` job prints a second output, `tests`.** `tests/integration/scripts/canary-paths.ts`
  reads the same diff and prints `canaries=…` and `tests=…`. On a pull request, `tests` is `false`
  when every changed file is documentation (`DOCS_PATHS`: `**/*.md`, `docs/**` and
  `apps/web/content/**`) and none is a page a test reads (`TESTED_DOCS`: the targets and
  diagnostics pages, which `tests/repo` compares with the code, and anything under
  `tests/integration/cases`, where `listCases` fails on a stray file). An empty list gives `true`.
  A push to `main` and `workflow_dispatch` always give `true`.
- **Every test job needs `changes` and runs on `!cancelled() && needs.changes.outputs.tests != 'false'`.**
  That covers the unit, integration, baselines, bench, pack, E2E and parity jobs. A failed filter
  leaves the output empty, so the tests still run (P2), and the run is red from the failed job. A
  skipped job counts as passed. `Format, lint & types`, `Build` and `Lighthouse` never wait for
  it: they are the required checks, and the docs site is built from the docs.
  `canaries.unit.test.ts` fails a job that is neither gated nor on that list, so a new job is
  gated from the start.
- **Markdown never starts the canaries.** `runsCanaries` drops every name that ends in `.md`
  before it matches `CANARY_PATHS`, so a README under a listed package runs none.
- **A push to `main` runs no canary.** `nightly.yml` runs them all every night, and
  `workflow_dispatch` still runs them all.
- **The canaries keep ADR-0073's gate.** They run only on `canaries == 'true'`, so a failed filter
  skips them, as before. Every entry of `CANARY_PATHS` is outside `DOCS_PATHS`, so `canaries=true`
  always comes with `tests=true`. A unit test holds that.
- **One `E2E` job and one `Integration: toolchain` job.** The E2E job runs every project of every
  app, one at a time, as `playwright.config.ts` does with `workers: 1`. The toolchain job runs
  `--project "toolchain:*"` in one Vitest process and uploads one `parity-toolchain` matrix.

This amends ADR-0073, whose canaries ran on every push to `main` and on any change under a listed
path, Markdown included. The rest of ADR-0073 stands.

## Consequences

**Positive:**

- A docs-only pull request runs four jobs: `Changes`, `Format, lint & types`, `Build` and
  `Lighthouse`.
- A pull request that runs the tests starts 12 fewer jobs, which frees slots in the shared queue.
- A push to `main` no longer spends about 170 runner-minutes on canaries the nightly runs anyway.

**Negative:**

- A docs-only pull request that deletes a package's `README.md` skips the tests, and
  `tests/repo/test/template.test.ts` then fails on `main`'s push run. Listing every package README
  in `TESTED_DOCS` would run the tests for every README edit, so we accept this, like ADR-0073's
  risk.
- A change that breaks a canary through a path the list leaves out reaches `main` and is reported
  by the nightly run, not by the push that merged it. The nightly was already the backstop for
  such changes on pull requests (ADR-0073).
- Each test job waits for `Changes`, a few seconds on a quiet queue.
- The merged toolchain job runs seven projects on one runner's four vCPUs, and the merged E2E job
  runs the seven apps one after another. On the pull request that made this change, they took 84
  and 126 seconds. A failure names its project, but no longer its job.

## Alternatives considered

- **A workflow-level `paths-ignore`.** It leaves the required checks pending, as ADR-0073 found.
- **Fail closed, as the canaries do.** A failed filter would then skip every test, and the only
  sign would be the red `Changes` job. Running them costs one full run in a rare case.
- **Treat every README as tested.** `template.test.ts` checks that each package has one, but a
  README edit can't break that check, so it would run every test for a typo.
- **Cache `node_modules` instead of merging jobs.** It saves part of the install step, not the
  container start or Node, and frees no slot. We measured it on the pull request that made this
  change, beside the pnpm store cache: a hit saved a median of 5.5 seconds of setup over six jobs
  and made one 9 seconds slower, and a miss spent up to 39 seconds saving it in the Playwright
  image. So we left it out.
