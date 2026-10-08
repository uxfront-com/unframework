---
name: local-verification
description: The environment book for Multica runs. Checkout and branch handling for Engineer and QA (the daemon's agent branch, pushing, draft PRs, fresh re-checkout), fresh-checkout setup order, build and check discipline, the no-background-process rule, what counts as verification, and a project section with the current project's install, build, test, and browser-harness commands and traps. Consult before running anything for the first time in a run and before diagnosing a "broken environment".
---

# Local verification

Every Multica run starts in a fresh or reused checkout under `workdir/<repo>`. Most "broken environment" reports are one of the traps in the **Project** section. Check there before debugging infrastructure someone already debugged.

## Checkout and branches

`multica repo checkout <url>` creates the checkout from the daemon's bare-clone cache on a branch named `agent/<agent>/<task>` that tracks `origin/<default-branch>`. That branch belongs to the daemon: a plain `git push` from it fails, and its name links to no issue. Always work on your own branch.

**Engineer, first run on a sub-issue:**

```bash
multica repo checkout <url>
cd <repo>
git switch -c <branch>                       # naming rule in squad-protocol
# … work, commit …
git push -u origin HEAD
gh pr create --draft --head <branch> --base <default-branch> --title "<title>" --body-file "$WORKDIR/pr-body.md"
```

Runs cannot answer prompts: pass every value as a flag.

**Engineer, fix round:** `multica repo checkout <url>` keeps uncommitted work and fetches. Then:

```bash
cd <repo> && git switch <branch> && git pull --ff-only
```

**QA, every verification:**

```bash
multica repo checkout <url> --ref <branch> --fresh
cd <repo>
test "$(git rev-parse HEAD)" = "$(gh pr view <pr-url> --json headRefOid -q .headRefOid)" || echo "HEAD is not the PR head"
```

`--fresh` discards leftovers from an earlier QA run. QA never commits or pushes.

## Fresh checkout setup

A fresh checkout has no installed dependencies and no build outputs. A build cache can report success without producing them. The order is always: install, then build the packages the change depends on, then check. Build only what you need; a full build is the most expensive step in a run. Log builds to a file and read the tail.

`TURBO_CACHE_DIR` (or the project's equivalent) is set on every agent to one absolute path, so checkouts share build artifacts. Do not override it.

The same agent on the same issue reuses the checkout. The daemon removes installed dependencies and build caches about 12 hours after the last run, so a resumed run may need to install again.

## Build and check discipline

- Run tests, typecheck, and lint **from the package directory**, targeted to touched files. Project-wide checks are for final PR preparation only.
- Build before typecheck when types crossed packages: consumers typecheck against built outputs.
- Never stream a full build or a full test run into your context. Redirect to a file, read the tail, grep for failures.
- Never start a background process that outlives the run. A harness must own its server's lifecycle.

## Verification is behaviour, not green checks

A change is verified when the affected flow was exercised and observed: a unit test for state logic, a component test for rendering, an end-to-end spec for a user journey, a live instance for anything visual. Paste the commands and their output in the DELIVERY. "Tests pass" without the paste is a claim, and QA re-runs claims.

## Amend this file

Every environment trap that costs more than fifteen minutes becomes a **Skill amendment** line in your report, with the exact text for this file. The owner applies it and re-imports the skill.

---

## Project: Unframework

Replace this section when the squad moves to another project.

**Repository.** `git@github.com:uxfront-com/unframework.git`, default branch `main`, checkout directory `unframework`. pnpm workspaces with Turborepo. Node 24 or later; `packageManager` pins pnpm.

**Install.**

```bash
pnpm install --frozen-lockfile --prefer-offline > install.log 2>&1   # hardlinks from the global pnpm store
tail -n 20 install.log
```

The install also downloads the Chromium the browser tests use (`tests/integration/scripts/ensure-browser.ts`) and runs `nuxt prepare` for `apps/web`, whose generated tsconfigs type-aware lint and `check-types` resolve through. Workspace packages export `src`, so tests and type checks need no build. Build only the docs site (`pnpm --filter web build`) or a release.

**Checks.** Narrow first; the project-wide loop is for final PR preparation only.

```bash
pnpm --filter @unframework/<pkg> test                                         # one package's tests
pnpm --filter @unframework/<pkg> check-types
pnpm exec oxlint <files> && pnpm exec oxfmt --check <files>                   # lint and format touched files
pnpm --filter @unframework/integration test -- --project compile              # L1, L2: the fastest corpus check
pnpm --filter @unframework/integration test -- --project "toolchain:<target>" # L3, L4, L5
pnpm --filter @unframework/integration test -- --project "ssr:<target>"       # L6
pnpm --filter @unframework/integration test -- --project "browser:<target>"   # L7, L8, L10, L11, L13
UF_TARGETS=vue,react pnpm --filter @unframework/integration test              # some targets only
pnpm format:check && pnpm lint && pnpm check-types && pnpm test               # the full loop, as CI runs it
```

Commands that write artefacts: `pnpm test:update` (golden outputs and shared expectations), `pnpm test:baselines` (Linux screenshots and geometry, Docker), `pnpm test:canaries` (after a harness change), `pnpm --filter @unframework/ir generate` (after an IR type change), `pnpm --filter unframework vendor:jsx` (after a `@vue/runtime-dom` bump).

**Traps.**

- A run that names a project, applies a filter or sets `UF_TARGETS` is partial, and its summary judges only what ran. Before a DELIVERY on a compiler change, run every live layer on all seven targets, or list what did not run under **Not verified**.
- `pnpm test:update` refuses while `CI` or `UF_CANARY` is set: unset them in the run. It needs `vue` among the targets, because Vue writes the shared expectations. It deletes stale expectation files: run it only on your own branch, commit first, and read `git status` after.
- Linux pixels and geometry come only from `pnpm test:baselines`, in Docker on linux/amd64 (emulated and slow on Apple silicon). Docker must be running. On macOS the browser tests compare the targets live with Vue and write nothing visual, so a missing baseline fails only in CI.
- Too much parallelism starves the browser suites and Angular's ngtsc past Vitest's timeouts. Run the unit suites as CI does: `pnpm exec turbo run test --filter='!@unframework/integration' --continue --concurrency=2`. A timeout or a flaky parity cell is a bug; never retry it.
- `turbo` re-adds a managed agent-guidance block to `AGENTS.md` when it detects an agent. Commit it; do not delete it.
- `@unframework/repo-tests#test` never caches. It fails a package that drifts from the template, a layering violation, and a diagnostics docs section that differs from the catalogue.
- TypeScript 6 lives only in `tests/toolchains/{vue,svelte,astro,angular}`, and the Angular compiler stack loads only from `tests/toolchains/angular`. A missing `@angular/compiler-cli` or `@typescript/typescript6` elsewhere means the wrong module imports it.
- `packages/compiler-v1` is gitignored and may sit in a reused checkout. Never import it.
- Never delete, move or restore files outside your scope, and never run a script that removes files outside `workdir/`. A cleanup script once deleted all of `tests/integration/cases` in a shared worktree.

**Docs site.** `pnpm --filter web build` prerenders every page and fails on a broken link. For homepage changes, `pnpm build`, then `pnpm --filter web lighthouse` must score 100 in every category. `pnpm --filter web dev` and `preview` are servers: run them only inside a script that stops them before it exits.
