# ADR-0123: Canaries gate the merge queue

- **Status:** Accepted
- **Date:** 2026-11-25
- **Plan:** §7.7, §7.9; P2; ADR-0052, ADR-0073, ADR-0084, ADR-0115; amends ADR-0073 and ADR-0084

## Context

CI's time goes to the queue for runners, not to the tests (ADR-0084). The organisation's GitHub
plan runs 20 jobs at a time, shared by every pull request. A pull request that changes the compiler
starts 71 jobs in `ci.yml` and uses 325 runner-minutes, 213 of them in the 37 canary jobs.

Alone on the runners, such a run took 20.2 minutes, and beside one other pull request 50.5. On 20
runners, the canaries alone need at least 10.7 minutes.

A canary answers one question: does each live layer still catch its corruption? That answer
matters when code lands on `main`. A pull request ran it on each of its pushes, 2.8 on average over
two weeks, and on its merge ref at push time, which can be stale by the time it merges. No canary,
unit, integration or parity job was a required check, so a red canary could sit on a mergeable pull
request.

## Decision

- **`ci.yml` runs in the merge queue** (`merge_group`, `checks_requested`). A merge-group run runs
  every job a pull request runs, except `Baselines`, which makes files for a pull request to
  download.
- **The merge queue runs the canaries by ADR-0073's rule.** The `changes` job fetches the group's
  `base_sha`, diffs it against the group's head with `--no-renames`, and runs the canaries when the
  diff touches `CANARY_PATHS`. That is the exact commit `main` receives.
- **A pull request runs the canaries only when it changes the harness itself.** The list is
  `HARNESS_PATHS` in `tests/integration/scripts/canary-paths.ts`: the workflow, the setup action,
  the harness, its scripts and the files at its package's root, and `packages/testing`. Each entry
  is also on `CANARY_PATHS`, and a unit test holds that. There a canary is most likely to fail, and
  review reads it before the change reaches the queue.
- **The script decides every event.** `canary-paths.ts --event <name>` prints `canaries` and
  `tests` for `pull_request`, `merge_group`, `push` and `workflow_dispatch`, and fails on any other
  event (P2). A push to `main` still runs every test job and no canary, and `workflow_dispatch`
  still runs them all (ADR-0084). With no `--event`, it prints the `CANARY_PATHS` answer that
  `pnpm test:full` reads.
- **One aggregate check, `Merge gate`** (job `gate`). It needs every other job in `ci.yml`, runs
  unless the run is cancelled, and fails unless `changes` succeeded and every other job succeeded
  or was skipped. A matrix job can't be a required check by name, so this job carries the canaries
  and the parity matrix into the merge rule. `canaries.unit.test.ts` fails a job left out of its
  `needs`.
- **The repository requires it.** Ruleset `Default` requires a merge queue on `main` and the
  `Merge gate` check, and the pull request rule needs no approval, so the PR's author can queue it.
  The organisation admin's bypass stays, for emergencies.

The canary list, the matrix, its shards, the run line, the timeouts and `nightly.yml`'s run don't
change. This amends ADR-0073, whose canaries ran on every pull request that touched
`CANARY_PATHS`, and ADR-0084, whose `changes` job decided `push` and `workflow_dispatch` in the
workflow. The rest of both stands.

## Consequences

**Positive:**

- A pull request that changes the compiler, the corpus or the lockfile, and not the harness, starts
  about 35 jobs and 113 runner-minutes instead of 71 and 325.
- Every canary still runs before `main`, on the merge result, and a miss now blocks the merge.
  Every unit, integration, parity and e2e job blocks it too.
- Several pull requests can share one queue run, so the canaries run once per merge or per batch,
  not once per push.

**Negative:**

- A canary miss on a pull request that doesn't change the harness shows in the queue, after review.
  The pull request leaves the queue and goes back to its author.
- Each merge waits for one queue run, about 20 minutes. A busy day queues merges.
- A merge that bypasses the queue runs no canary before `main` for a change outside the harness.
  `nightly.yml` reports it within a day.
- A red or timed-out test job now holds the queue until someone fixes it.

## Alternatives considered

- **Make the canaries cheaper on pull requests.** Even with no setup per job, 213 runner-minutes
  need at least 10.7 minutes of 20 runners, on top of the other jobs.
- **Stop a canary once its layer catches the corruption.** `judgeCanary` requires a catch on every
  case and target the canary corrupts. Stopping early weakens that verdict.
- **Run the canaries when a pull request leaves draft.** It repeats every test job on the same head,
  and still tests a merge ref that can go stale.
- **Paid or larger runners.** They cost money, and the same work still runs on every push.
- **`Merge gate` over the canaries and parity only.** It meets the rule above, but leaves a red unit
  or e2e job mergeable, as before.
