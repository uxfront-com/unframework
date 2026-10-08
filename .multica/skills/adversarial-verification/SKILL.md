---
name: adversarial-verification
description: QA's verification manual for a Multica squad. The adversarial protocol (assume broken, prove it), the finder and refuter subagents that stand in for Ultracode's vote-based verification, the CONFIRMED versus PLAUSIBLE standard, manual testing on an isolated instance, CI wakeups and their fallback, audit sub-issues, the mutation-testing tiebreak, what never to block on, and a project section with the current project's review-rule groups, anti-pattern checklist, and test harness. Consult at the start of every verification run.
---

# Adversarial verification

A builder agent grades its own work generously. This seat compensates. Operating assumption: **the delivery is broken; prove it.** When you fail, pass it, and list what you did not try. One complete pass per round. A slow or dripping review stalls the stage.

Ultracode verifies a finding by asking several independent agents to refute it and drops it when they succeed. The squad gets the same effect inside one run: finder subagents find, a refuter subagent per finding attacks, you judge, and only what survives blocks. The **Project** section at the end holds the project's rule groups, checklist, and harness.

## Protocol

1. **Open the sub-issue first.** Its acceptance criteria are the test plan. Work beyond the sub-issue scope is a finding, even when the extra work is good.
2. **Check out the delivered branch fresh** and confirm `HEAD` is the PR's head commit (commands in `local-verification`). A leftover file from an earlier QA run would otherwise sit under the review.
3. **Re-run, never re-read.** Pasted output is a claim. Re-run every command in the DELIVERY from the package directory. A command that does not reproduce is a finding on its own.
4. **Tests before code.** For every new or changed test ask: can this test fail? Revert the fix locally and watch it fail when that costs little. New behaviour without a test blocks. Assertion-thin suites get the mutation tiebreak.
5. **Finders.** Spawn read-only subagents in parallel, one per lens, on your own model. Give each the diff, the criteria, and its checklist. Ask for findings with `file:line`, a failure scenario, and a confidence. Lenses: correctness, scope and diff hygiene, security, test quality, and one per project review-rule group whose paths match the diff.
6. **Refuters.** For each finding, spawn a subagent whose only job is to disprove it: run the scenario, read the surrounding code, check the written convention. Default to "refuted" when uncertain. Then read its answer and decide. CONFIRMED means the failure reproduced or the exact line violates a written rule. Everything else is PLAUSIBLE and does not block.
7. **Manual test** for UI and runtime behaviour. Recipe below.
8. **Automated reviewer.** Read any automated review comments on the PR before a PASS; treat each as a finding to confirm or refute.
9. **CI**, then the VERDICT in the shape from `squad-protocol`, as a reply under the comment that woke you. Set `qa_round` in the sub-issue metadata first.

## The CONFIRMED standard

A CONFIRMED finding carries:

- the exact `file:line`;
- the failure: a command and its output, or the written rule and the line that breaks it;
- the smallest change that would clear it.

Rank CONFIRMED findings by impact. PLAUSIBLE findings and nits go in their own list and never block.

## Manual test

Run it for every change a user can see or trigger.

1. Capture the run's working directory before you enter the checkout (`WORKDIR=$(pwd)`). Screenshots go there; nothing goes into the checkout.
2. Start an isolated instance through the project's browser test harness. The harness must start and stop the server itself; a server you start in the background fails the run.
3. Drive the flow with a focused existing spec, or a short throwaway spec that uses the harness's page objects. Save screenshots of the before and after states to `$WORKDIR`.
4. Attach the screenshots to the VERDICT with `--attachment`.
5. Delete the throwaway spec. It is never committed.

## CI

1. Register the wakeup on the PR checks first. Then read the checks. The condition ignores checks that finished before registration, so if they already finished, delete the wakeup and continue.
2. Pending: post `VERDICT: PENDING CI` under the trigger with everything else already filled in, and stop. The wakeup run reads the checks and posts the final VERDICT under the same trigger.
3. A red check caused by the change is a CONFIRMED finding. A red check caused by the default branch is a note for the Planner, not a block.

Without a PR integration in the workspace (no PR card, no `pull-requests` data), read the checks with the Git host's CLI and register a one-shot timer instead:

```bash
multica issue wakeup create <sub> --kind at --after 30m --parent <trigger-comment-id> --instruction-file ./ci.md
```

## Audit sub-issues

When a sub-issue assigned to you asks for findings instead of a verdict:

1. Round one: finders with distinct lenses over the named area. Refute every finding.
2. Next round: fresh lenses (by failure mode, by boundary, by history, by test gap). Stop when a round confirms nothing, or when the sub-issue's budget is spent.
3. Post the AUDIT REPORT with CONFIRMED findings, each with a reproduction, and an issue request per fix. Mark the sub-issue `done`.

## The mutation-testing tiebreak

When tests pass but assert little, run mutation testing on the changed files. Surviving mutants in changed code are findings: name the mutant, the line, and the missing assertion. It is expensive; use it as a tiebreak, not by default. The project section names the command.

## Do not block on

Taste no convention backs, hypothetical future requirements, formatting the tooling accepts, or pre-existing debt the diff sits near. Note each once as a nit. Reviews that relitigate settled conventions teach builders to ignore reviews.

## Systemic findings

The same finding class on two different issues is systemic. Say so under **Systemic** in the VERDICT. The Planner turns it into a skill amendment or a lint-rule proposal. The checklist below should shrink over time, not grow.

---

## Project: Unframework

Replace this section when the squad moves to another project.

**Review-rule groups.** The repository has no path-scoped review rules; `AGENTS.md` is the rule book. Run one finder per group whose paths match the diff, with that group's sources as its checklist, plus correctness, scope, security, and test quality.

| Group | Paths | Checklist |
|---|---|---|
| `compiler-core` | `packages/{ir,diagnostics,parser,analyzer,codegen,compiler,unplugin}` | `AGENTS.md`: Loud, never silent; Deterministic; Layering and TypeScript; Targets and the IR. The package's README contract |
| `targets` | `packages/target-*` | `AGENTS.md`: Targets and the IR, and the Target notes table. Plan §6 |
| `corpus-and-harness` | `tests/integration`, `tests/toolchains`, `packages/testing` | `tests/integration/README.md` (the spec rules of ADR-0043, the rules that keep it honest). `AGENTS.md`: Never weaken a check |
| `language-and-types` | `packages/unframework` | Plan §4. `AGENTS.md`: The source language is fixed by the plan |
| `docs-and-decisions` | `apps/web/content/docs`, `docs/` | `AGENTS.md`: Done means green on seven targets (verbatim examples), Record a decision, Code and prose |
| `repo-and-build` | Root configuration, `pnpm-workspace.yaml`, `turbo.json`, `.github/`, `tests/repo`, `scripts/` | `AGENTS.md`: Versions, Add a package. `.github/CONTRIBUTING.md` |

**Automated reviewer.** None is configured. Read any other comments with `gh pr view <url> --comments` before a PASS.

**Anti-pattern checklist** (block once confirmed):

1. A hand-edited generated file: re-running its command on the PR head changes it.
2. A changed golden output or expectation under `tests/integration/cases` that the DELIVERY does not name and explain. A Vue rendering change that moved every target's expectations without saying so.
3. A weakened check: `.skip`, `.only`, retries, a deleted assertion, a loosened normaliser, pixel tolerance without a reason, a quarantine or coverage exemption without a reason and an issue.
4. A pass, plugin or target that throws instead of returning a diagnostic. A construct copied into an output without analysis.
5. A new diagnostic without all of: a catalogue entry in its band, the exact span, a `cases/diagnostics/` case or an `EXEMPT_CODES` entry, and its docs section with the `[UFxxxx]{#UFxxxx}` anchor. A reused or renumbered code.
6. Non-deterministic output: time, randomness, environment data, absolute paths, file-system order.
7. A layering violation. A target that imports another target, or anything beyond `ir` and `codegen` in its main entry. TypeScript's API outside the test toolchains. Any import of `packages/compiler-v1`.
8. Framework logic in `ir`, `analyzer` or `codegen`. A runtime import in an output. A difference between targets that only a test shows, with no capability cell.
9. An IR field no consumer reads, a node without a span, IR types changed without a regenerated schema or updated `checkInvariants`.
10. Output a senior developer of that framework would not write (the Target notes): destructured Solid props, Svelte `class:` directives, a Vue optional prop without a default that is not `= undefined`, a QRL capture rule broken in Qwik.
11. A second syntax for one concept, or a change to the language, a mapping, the harness's rules or the layering without an ADR. An edited accepted ADR.
12. A version outside the catalog. An output-shaping dependency (oxc, oxfmt, `@typescript-eslint/scope-manager`) not pinned exactly.
13. TypeScript outside `erasableSyntaxOnly` (enums, namespaces, parameter properties), a local import without `.ts`, a type imported as a value, an export without an explicit type.
14. A feature without its docs page. A docs example that is not a verbatim copy of a case and its golden outputs.
15. A corpus spec that branches on the target, asserts only absences, uses hooks, or names a scenario with anything but a kebab-case string literal.
16. PR hygiene: a title that is not Conventional Commits, an unfilled template, a ticked checklist item nobody ran, American spelling in prose, a missing changeset for a published package.

**Per-area checks.**

- **compiler-core:** the package's tests and the `compile` project pass. A newly supported construct no longer reports UF1002, and a case covers it. The package README still describes the contract.
- **targets:** the target's own `emit` and render-parity tests, then its `toolchain:`, `ssr:` and `browser:` projects. Read the diff of `__output__/<target>/` as that framework's reviewer would.
- **corpus-and-harness:** `pnpm test:canaries` for any harness change: every live layer still catches its corruption. The quarantine and the exemptions only shrink.
- **docs-and-decisions:** `pnpm --filter web build` prerenders every page and fails on a broken link. `tests/repo` passes, so the diagnostics page matches the catalogue.
- **bug fixes:** the new case or test fails on the parent commit for the stated reason.

**Manual test harness.** The corpus is the harness: Vitest's browser mode starts and stops Chromium and each framework's Vite server itself. From the checkout root:

```bash
pnpm --filter @unframework/integration test -- --project "browser:<target>" > browser.log 2>&1
tail -50 browser.log
```

On macOS every target is compared live with Vue's capture from the same run, and nothing visual is written. Visual diffs land in `tests/integration/.reports/diffs` and failures in `.reports/failures`; copy what you attach to `$WORKDIR`. To compare with the committed Linux baselines as CI does, run `pnpm test:baselines:check` (Docker; `UF_BASELINE_PLATFORM=linux/arm64` runs natively on Apple silicon, for checks only).

To exercise a construct no case covers, add a throwaway case under `tests/integration/cases/<area>/<name>/`, run `pnpm test:update` with `vue` among the targets, then the browser project. Delete exactly the files you created, and confirm `git status` is clean.

For docs and homepage changes: `pnpm --filter web build`, then a short throwaway script that starts `pnpm --filter web preview`, takes the screenshots into `$WORKDIR`, and stops the server before it exits.

**CI and PR data.** With the GitHub App installed, `multica issue pull-requests <sub>` mirrors the checks and `--until-pr checks` fires. Without it, read `pr_url` from the sub-issue metadata and use `gh pr checks <url>` with the timer fallback above. The **Parity matrix** job fails when any (case, target, live layer) cell is missing or failing; its `parity-matrix` artefact names the cells. A timeout or a flaky parity cell is a bug in the compiler or the harness, never a retry.

**Mutation tiebreak.** No mutation-testing tool is installed. Mutate by hand: invert or revert a changed line and confirm a case or a unit test fails. For harness changes, `pnpm test:canaries <layer>` is the mutation run.
