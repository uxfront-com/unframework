# ADR-0089: The sample design system's tests run from tarballs, outside the workspace

- **Status:** Accepted
- **Date:** 2026-11-12
- **Plan:** §7.9, §8.5, §8.6, §9 M7; R8, R12; amends ADR-0079, whose TypeScript 6 exception it
  widens; ADR-0084, ADR-0086, ADR-0087

## Context

M7's exit asks for the sample design system's tests and visual suite to run in CI from
published-shape packages. Inside the workspace they prove less than that:

- **pnpm links workspace members.** `tests/e2e/design-system` reaches `@unframework.dev/testing`
  and `@unframework.dev/visual` through `workspace:*`, so it runs their `src`, never the `dist`
  their `publishConfig` names.
- **The toolchains come from the repository.** Its `unframework.config.ts` points
  `package.resolveFrom` at `../../toolchains/…`, which a user's project doesn't have.
- **`prepare-apps` packed neither package.** It packed `@uxfront/unframework` and
  `@unframework.dev/unplugin` with their `dependencies`, and the umbrella reaches testing and
  visual only through optional peers, which that closure doesn't follow.

ADR-0079 already installs the design system's tarball in seven apps outside the repository. The
same mechanism can install the design system itself as a user's project would.

## Decision

- `prepare-apps` packs `@unframework.dev/testing` and `@unframework.dev/visual` with their
  dependency closures, beside the umbrella and the plugin.
- It installs a second kind of copy, `<work>/design-system`, outside the repository like the apps:
  - Its files are the design system's `src`, `examples` and `test`, and an `unframework.config.ts`
    with the same targets and no `resolveFrom`.
  - Its `devDependencies` are exactly what `4.tooling/5.testing.md` and `6.visual.md` tell a project
    to install, each target's framework and Vite plugin and Angular's compiler stack included. The
    three packed packages come from their tarballs. The rest take their versions in the `catalog:`, and
    TypeScript 6 the Angular toolchain's. A harness test holds the list to the docs.
  - Its `pnpm-workspace.yaml` holds the apps' overrides and allowed builds, plus three settings of
    the root's: Analog's `typescript` peer, the pin of `@typescript/typescript6`'s TypeScript and
    Qwik's `vitest` peer. A harness test holds each to the root's own entry.
  - Once installed, `assertInstalledFromTarball` checks `@uxfront/unframework`,
    `@unframework.dev/testing` and `@unframework.dev/visual` in the copy.
- `prepare-apps --only apps` and `--only design-system` install one kind of copy.
- `pnpm --filter @unframework.dev/e2e design-system` runs `unframework test` and then
  `unframework visual` in the copy. Both always run, so a failed test still leaves the report, and
  the script fails when either does.
- CI's `Design system` job downloads the `Pack` job's tarballs, installs the copy and runs the
  script in the Playwright image, on all seven targets. It takes ADR-0084's `changes` gate, uploads
  the visual run directory (`report.html`, `report.json` and the images) even on failure, and isn't
  a required check. `test:full` runs the script after the e2e apps.
- **The TypeScript 6 exception widens.** ADR-0079 let the Angular e2e app declare TypeScript 6,
  installed only into its copy. The design system's copy declares it too, with Angular's compiler
  stack, because its Angular projects compile there. It's installed only into that copy, so
  TypeScript 6 still reaches no workspace package. `AGENTS.md` names both.

## Consequences

**Positive:**

- The design system's tests run on what a user installs: the packed `dist`, the documented
  dependencies and nothing from the repository. A package the docs forgot, or an export a tarball
  lacks, fails CI.

**Negative:**

- One more job of a few minutes on every pull request that changes code.
- The copy repeats three of the root's pnpm settings. The harness's tests keep them in step, but a
  new setting the copy needs has to be added in both places.

## Alternatives considered

- **Run the suites in the workspace's design system.** It runs the packages' `src` through
  `workspace:*` links and the repository's toolchains, which is what M7's exit asks us to get past.
- **Build the copy's manifest from the design system's own `devDependencies`.** They hold what the
  repository's build of it needs, like `tsdown`, and none of the Vite plugins or Angular's stack,
  which it takes from the toolchains. The docs' list is the one a user follows, so the copy follows
  it.
- **A job per target.** The org runs about 20 jobs at a time, and the whole run takes minutes, so a
  matrix would cost more in setup than it saves.
