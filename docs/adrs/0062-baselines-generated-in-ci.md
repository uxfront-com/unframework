# ADR-0062: CI generates the Linux baselines, and a script applies them

- **Status:** Proposed
- **Date:** 2026-10-20
- **Plan:** §7.4, §7.6, §7.9, §9 M4, R10; D9 (ADR-0013); amends ADR-0029; closes the open items of
  ADR-0013 and ADR-0019 on baselines in CI

## Context

The committed screenshots and geometry come from `pnpm test:baselines`: an update run of
`browser:vue` in `mcr.microsoft.com/playwright:v1.63.0-noble` on linux/amd64 (ADR-0019,
ADR-0029). On Apple silicon that image runs under emulation, which is slow, and needs Docker.

Two items were left open:

- ADR-0013: "Generating baselines in Linux CI is part of M4's scope."
- ADR-0019: validate the baselines, made under Rosetta, on a real GitHub x64 runner.

§7.4 says CI never writes artefacts. So CI can generate baselines, but it can't commit them.

## Decision

- **A `Baselines` job in `ci.yml`.** It runs on `pull_request` and `workflow_dispatch`, never on a
  push to `main`, in the baseline image on `ubuntu-latest`.
  - It runs `baselines.sh ci`, which calls `baselines-in-container.sh update` directly instead of
    through `docker run`. The container script takes its four directories (the repository, the
    work copy, the output and the pnpm store) from `UF_BASELINE_REPO`, `UF_BASELINE_WORK`,
    `UF_BASELINE_OUT` and `UF_BASELINE_STORE`, with the container's paths as defaults.
  - The run is the same: a copy of the checkout, installed there, `browser:vue` and the reference
    passes (ADR-0057) with `UF_UPDATE=1`, and the guard that fails on a DOM, ARIA, trace or server
    HTML expectation that reads otherwise on Linux.
  - The baselines that changed or are new pass the same copy-back filter as `update`, into
    `UF_BASELINE_ARTEFACT`, and go up as the artefact `baselines`. With none, nothing is uploaded.
  - The job never pushes, and has no credentials. A baseline that differs fails no PR here:
    `Integration: browser` stays the check. The parity job doesn't wait for it, because an update
    run's matrix is no evidence of parity.
- **`pnpm test:baselines:download [<run-id>]`** runs `baselines.sh download`.
  - Without a run id, it takes the latest `ci.yml` run of the current branch, and refuses it
    when that run is of another commit than HEAD: an older push, or a fork's branch of the same
    name. A named run of another commit only gets a warning.
  - It asks for the artefact by name (`artifacts?name=baselines`), since the list of a run's
    artefacts is paged and a run whose baselines changed has about 30.
  - It reads the run's `Baselines` job, not the whole run: the artefact is complete once that job
    is. It refuses a run without the job (a push to `main`) or one whose job hasn't completed.
  - With no `baselines` artefact, it writes nothing and says so when the job succeeded, and fails
    otherwise.
  - It downloads the artefact with `gh run download` and copies it through the same filter: only
    regular files at `cases/<area>/<case>/__screenshots__/<scenario>-chromium-linux.png` or
    `__expected__/geometry.<scenario>.json`, or nothing at all.
  - When the run's `Baselines` job failed, it still copies what was uploaded, and fails, as
    `update` does.
- **This amends ADR-0029's write policy.** A CI job may now run in the baseline environment with
  `UF_UPDATE=1`, but only inside its own copy of the checkout. What it writes reaches the repository
  only as a reviewed commit, made by a person who ran the download.
- `pnpm test:baselines` stays the local path, and `pnpm test:baselines:check` the local check.
- On a pull request, the job checks out the PR's merge commit with its base, as every CI job does,
  so its baselines are those of the tree `Integration: browser` compares. The run's `headSha` is
  the PR's head, which is what the download compares with HEAD.

## Consequences

**Positive:**

- A contributor on any OS gets the Linux baselines without Docker: push, wait for the job, run the
  download, review and commit.
- Baselines come from the runner CI compares them on, so emulation can no longer make them differ.
- The baselines made under emulation hold on a real x64 runner (Evidence), which closes ADR-0019's
  open item.

**Negative:**

- Every pull request pays for one more install and one more `browser:vue` run, about six minutes,
  since the run keeps the container's one test file at a time.
- A baseline reaches the branch one push later than the change that needs it.
- The download needs the GitHub CLI, signed in to the repository.

## Alternatives considered

- **CI commits the baselines.** It breaks §7.4, and a bot commit would skip the review a visual
  change needs.
- **Run `pnpm test:baselines` in CI through Docker.** The job would start a second container
  inside the first for no gain: the job already runs in the image.
- **Upload every baseline, changed or not.** The download would then rewrite every file, and the
  artefact would no longer show what changed.

## Evidence

- `harness/baselines.unit.test.ts` runs `ci` with a stand-in container script, and `download`
  with a stand-in `gh`: what each copies, what each refuses, the empty case and the failed job.
- `harness/summary.unit.test.ts` checks that the parity job doesn't wait for the `Baselines` job.
- The first `Baselines` run, on `ubuntu-latest` (x64): `browser:vue` passed 418 tests in 155 files
  with 2 skipped, and its reference pass 2, in 313 s. No baseline differed from the committed ones,
  which were made under emulation, so the job uploaded nothing. `pnpm test:baselines:download`
  on that run reported "changed no baseline; nothing was written".
- A probe branch that deleted one committed screenshot and changed one value in one geometry file
  got exactly those two files back in its artefact, and after the download its cases equalled the
  unprobed commit.
