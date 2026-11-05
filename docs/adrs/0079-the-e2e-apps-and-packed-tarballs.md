# ADR-0079: The e2e apps install packed tarballs outside the workspace

- **Status:** Proposed
- **Date:** 2026-11-05
- **Plan:** §5.2, §7.9, §8.2, §9 M6; R8, R12; ADR-0027, ADR-0075, ADR-0077; records an exception to
  ADR-0022's TypeScript 6 rule, without editing that record

## Context

M6's exit says the sample design system "installs from packed tarballs and renders in all seven
apps". Each app also works in plugin mode where its framework allows, which is six of them, and every
app has Playwright smoke and HMR tests. Five facts shape how they install:

- **Workspace members never install a tarball.** pnpm links them, so a member can't show that a
  package's `files` and `exports` hold up.
- **Nothing resolves upward by accident.** A copy inside the repository would find the workspace's
  `node_modules`.
- **pnpm 11 ignores `package.json#pnpm`.** It warns that the field "is no longer read", so a copy's
  overrides and allowed builds go in a `pnpm-workspace.yaml`.
- **The name `unframework` on npm belongs to a third party.** A copy has to override it, or the
  install fetches that package.
- **`AGENTS.md` keeps TypeScript 6 in `tests/toolchains`.** An Angular CLI app needs its own compiler
  stack beside it.

The project's owner chose plain apps: Vite apps for React, Vue, Svelte, Solid and Qwik, an Astro app,
and an Angular CLI app on `@angular/build`.

This record is proposed before M6 builds it. Each section below is amended in place as its part is
built.

## Decision

### Runner and working copies

- Each app sits under `tests/e2e/apps/`, outside the workspace, and pins exact catalog versions with
  no path specifier. It holds per-mode files, so that adding a mode's work edits no shared file:
  `vite.config.plugin.ts` and `vite.config.package.ts` (Astro: `astro.config.plugin.mjs` and
  `astro.config.package.mjs`), `src/plugin/` and `src/package/`, `e2e/plugin/` and `e2e/package/`.
- `pnpm --filter @unframework/e2e prepare-apps` does four things:
  1. It builds the workspace packages the apps consume, and runs the design system's `pack:dist`
     script if present.
  2. It runs `pnpm pack` on each into the gitignored `tests/e2e/.tarballs/`, the design system from
     `dist/package` when that exists.
  3. It copies each app to `<work>/<app>`, where `<work>` is `$UF_E2E_WORK_DIR` or
     `<os.tmpdir()>/unframework-e2e`. It adds `file:` tarball specifiers to the copy's dependencies,
     and writes the copy's `pnpm-workspace.yaml`, with `overrides` for every packed package and
     `allowBuilds`.
  4. It runs `pnpm install --prefer-offline` inside the copy, and prints the copy's path.
- `pnpm --filter @unframework/e2e e2e` runs Playwright on Chromium with `retries: 0`. A project is
  `<app>:<mode>`, found from each app's `e2e/<mode>/` directory.
- A worker-scoped fixture starts each dev server from the working copy's own `vite` or `astro`
  through `createRequire`, and stops it in teardown. A global teardown fails if a port still listens.
- An `edit(file, from, to)` helper changes a file for an HMR test and restores it after.
- The script is named `e2e`, not `test`, so the unit job skips it. The design system's script is
  `pack:dist`, not `build`, so the required `Build` check never packages it.

### Apps and the Angular exception

- There are seven apps: `react`, `vue`, `svelte`, `solid` and `qwik` on Vite, `astro` on Astro, and
  `angular` on `@angular/build`.
- Six apps have both modes. `angular` has the package mode only, because the Angular CLI has no plugin
  API (§8.2) and Analog plugin mode is deferred (ADR-0075). Its HMR test edits the app's own component.
- The fixture starts Astro's in-process `dev()`, and a spawned `ng serve` in its own process group,
  killed in teardown.
- **The exception to `AGENTS.md`'s TypeScript 6 rule.** The Angular app declares `@angular/cli` 22.2.0,
  which M6 adds to the catalog beside `@angular/build` 22.2.0, `@angular/compiler-cli` at its exact
  catalog version, and TypeScript 6 as `npm:@typescript/typescript6@6.0.2`, the specifier the
  toolchains use (ADR-0022). An Angular CLI app needs its compiler stack. The app sits outside the workspace, and it's installed only into its
  working copy, so TypeScript 6 still reaches no workspace package.

## Consequences

**Positive:**

- A smoke test passes only if a real tarball installs and runs, so a wrong `files` or `exports` entry
  fails where a consumer would see it.
- The installs resolve nothing from the repository, as a user's wouldn't.
- Later work adds an app's specs and files without touching a shared config.

**Negative:**

- With no lockfile, a copy's transitive versions float, within the exact direct pins. A new release of
  a transitive dependency can turn an e2e job red with no change here.
- Packing and installing seven apps takes time, so CI packs once and shares the tarballs.
- A TypeScript 6 now sits in one app outside `tests/toolchains`, so `AGENTS.md` has to name the
  exception beside its rule.
- Dev servers in-process and one spawned `ng serve` are ours to stop, and a leak would fail the run.

## Alternatives considered

- **Apps as workspace members.** They'd be fast, but they'd never install a tarball, and that's the
  exit.
- **A committed lockfile per app.** It would pin transitive versions, but it would hold local `file:`
  paths, which differ per machine.
- **Working copies inside the repository.** Node and pnpm would resolve upward into the workspace's
  `node_modules`, so a missing dependency would pass.
- **Meta-framework apps (Nuxt, SvelteKit, SolidStart, Qwik City).** They're out of M6, and the plain
  apps cover each framework's plugin.
- **An Analog app in plugin mode.** It needs `ngtscVirtual` shipped from the plugin first (ADR-0075).
