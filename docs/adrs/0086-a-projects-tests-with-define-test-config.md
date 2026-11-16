# ADR-0086: A project's tests run through `defineTestConfig` and `unframework test`

- **Status:** Accepted, amended by ADR-0104
- **Date:** 2026-11-11
- **Plan:** §7.2 (L6), §7.3, §7.6, §8.1, §8.3, §8.5, §9 M7; amends ADR-0076; ADR-0029, ADR-0057,
  ADR-0078, ADR-0085, ADR-0090

## Context

ADR-0085 made the case the public test unit, but only the corpus could run one. The setup file
and `mount` read the case list the harness provides (`ufHarness`), and only the harness built it.
A case id had to be `<area>/<name>` in kebab-case, and a case's main source had to sit in its
directory. Nothing built the per-target projects for a user's project, and no command ran them.

The server render comparison (L6) lived only in `tests/integration/harness/ssr.test.ts`. It found
its components with `import.meta.glob` relative to its own file, which can't work from a package
in `node_modules`.

Three more forces shaped the decision:

- **Layering.** `LAYERS` puts `@unframework.dev/cli` below `@unframework.dev/testing`
  (`tests/repo/test/layering.test.ts`), so the CLI can't import it.
- **Pixels.** The corpus compares pixels against committed Linux baselines in CI, and never live
  there (ADR-0029, `node/mode.ts`). A user's project has no baselines when it starts, and no Docker
  image to make them in.
- **Toolchains.** Angular's compiler stack, and TypeScript 6 for some checkers, can't be
  dependencies of a target package. ADR-0076's `package.resolveFrom` already says where a
  packager finds them.

## Decision

- **`@unframework.dev/testing/config` exports `defineTestConfig(options?)`.** It reads the
  project's `unframework.config.ts` through `loadConfig` and `resolveConfig`, and resolves to a
  Vitest configuration with a `browser:<target>` project in Chromium and an `ssr:<target>`
  project for each target. The projects are built from the pieces the harness uses: each
  toolchain's Vite fragment, the unplugin with its `onCompile` recorded, `parityBrowser` with the
  toolchain's browser commands and `ufMapStack`, the setup files, a run from `createHarnessRun`
  and `sequence.groupOrder`, so the reference runs first. Its options are `targets`
  (`unframework.config.ts`'s by default), `include` (`**/*.test.ts`, never in `node_modules` or
  `dist`), `reference`, `pixels`, `toolchainDirs` and `root`.
- **A case is any directory with one test file.** Its id is the directory relative to the
  project's root, with no naming rule, and the browser and the commands accept such ids.
  `case.json`'s `main` is a path relative to the case, which may lie outside it
  (`"../../src/Counter.uf.tsx"`). Without one, the main source is the directory's only `.uf.tsx`.
  Two test files in one directory, a case with no main source, a test file at the root and an
  unknown `case.json` key fail the run at startup, each with a message that names the fix. The
  corpus keeps its own rules in its harness: kebab-case `<area>/<name>` ids and a main source
  among the case's own files.
- **The reference is Vue when the project tests Vue, else its first target.** It always joins
  the run, and so does a target a case names as its own reference (ADR-0057), since the others
  compare with what they write. `--target react` therefore runs Vue and React.
- **Pixels compare live in a project by default, in CI too.** Every target compares with the
  reference's capture from the same run, in Chromium. `pixels: "baseline"` opts into committed
  baselines, and then only the baseline environment writes them, as in the corpus. The corpus's
  mode keeps its rule that CI never compares live. The run's scratch (the update ledger, live
  captures and diffs) goes in the project's `.reports/` and `.live/`.
- **`package.resolveFrom` gets a second job.** It says where a target's test toolchain resolves
  from, as well as its packager. `toolchainDirs` overrides it per target, and the project's root
  is the default.
- **One server render comparison.** `@unframework.dev/testing/ssr` exports
  `describeServerRender(cases)`, the scenario loop that was the harness's. The package ships a
  spec that calls it (`./ssr/spec`), which `defineTestConfig`'s `ssr:<target>` projects include by
  its resolved path, with no exclusion, so Vitest's default `**/node_modules/**` doesn't drop it. The ssr projects inline the package
  (`server.deps.inline`), since Node would otherwise load it and import each `.uf.tsx` past the
  unplugin, and the browser projects keep it out of the dep optimizer, whose copy would carry a
  second Vitest runner.
  The cases come from the provided `ufSsrCases`, each main source by its absolute path. The
  corpus's spec calls the same function as it's collected, with its own skips: a case with
  expected compile errors is left out, one with no `diagnostics.json` fails, and one whose every
  test needs a capability the target lacks is skipped. L14's deliberate throws stay in the
  harness. The `describe` title carries the target, `ssr [<target>]`, as `describeTargets` does.
- **The corpus's lint rule covers the sample design system's tests.** ADR-0085's
  `no-restricted-imports` override in `oxlint.config.ts` also applies to
  `tests/e2e/design-system/test/**/*.{ts,tsx}`, whose specs are a project's own, and
  `corpus-imports.test.ts` lints a probe spec there too.
- **The umbrella registers `unframework test`. This amends ADR-0076.** `@unframework.dev/cli`'s
  `main(argv, io, extra?)` takes extra commands of its own shape, which may not replace a
  built-in one, and lists them in its usage text. `@uxfront/unframework`'s `./cli` entry adds
  `test`, which loads `@unframework.dev/testing/cli` when it runs, and the bin calls it.
  `@unframework.dev/testing` is an optional peer dependency of the umbrella. When a package the
  command needs is missing, it exits 2 with the packages to install.
- **`unframework test [--target <t>]… [--update] [-- <vitest args>]`** runs Vitest on the project's
  `vitest.config.ts` when there is one, or else on `defineTestConfig()`. It hands the targets and
  the mode on as `UF_TARGETS` and `UF_UPDATE`, and refuses Vitest's own `--update`, which would let
  every target write the shared expectations. It exits 0 when every test passes, 1 when one fails,
  and 2 on a usage or configuration error, as the CLI's other commands do.

```ts
// vitest.config.ts
import { defineTestConfig } from "@unframework.dev/testing/config";

export default defineTestConfig({ pixels: "live" });
```

## Consequences

**Positive:**

- A design system tests its components the way the corpus does, with the same setup, the same
  layers and the same expectations, on the targets its own configuration names.
- The server render comparison exists once, and the corpus's ssr projects exercise it on every
  case.
- A project's CI compares pixels from its first run, with no baseline image to build.

**Negative:**

- Live pixels in a project's CI compare one target with another on the CI's own machine. They
  catch a difference between targets, never a change to every target at once, which only
  baselines catch.
- `defineTestConfig` resolves to a promise, since `unframework.config.ts` loads asynchronously.
  Vitest awaits a configuration's default export, but a project that merges it with another
  configuration has to await it first.
- The harness keeps its own project builder (`tests/integration/harness/projects.ts`), with its
  canaries, stand-ins, engines and quarantine. Two builders now make projects from the same
  pieces, and a change to one of those pieces must reach both.
- `UF_TARGETS` and `UF_UPDATE` reach a project's own `vitest.config.ts` through the environment,
  so a run started with `vitest` directly reads them too.

**Open:**

- Building the corpus's projects on `defineTestConfig` is a proposed issue.
- Running the sample design system's tests in CI, from packed tarballs, is M7's P6.

## Alternatives considered

- **Register `test` in `@unframework.dev/cli`.** The layering forbids it, and moving `cli` above
  `testing` would make every CLI install pull in the test stack.
- **Keep the SSR spec in the harness and copy it into the package.** Two comparisons would drift,
  and the corpus would stop proving the one users get.
- **Baselines by default in a project's CI.** A project would need the baseline image (Docker on
  linux/amd64) before its first green run, which plan §8.5's "test exactly the way Unframework
  tests the compiler" doesn't ask for: the corpus itself compares live everywhere but in CI and
  the baseline image.
- **Kebab-case `<area>/<name>` ids for every project.** It would force a layout on a design system
  that keeps its tests elsewhere, and the id only has to be unique.
