# Contributing to Unframework

This is the Unframework monorepo: a [Turborepo](https://turborepo.dev) on [pnpm](https://pnpm.io) workspaces, set up like [uxfront](https://github.com/uxfront-com/uxfront).

Found a bug, or have an idea? Search the [existing issues](https://github.com/uxfront-com/unframework/issues?q=is%3Aissue) first, then [open a new one](https://github.com/uxfront-com/unframework/issues/new/choose): a feature request, or a site bug. Everyone taking part agrees to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Layout

- `apps/web`: the Nuxt site for [unframework.dev](https://unframework.dev), the homepage and the documentation at `/docs`. See [`apps/web/README.md`](../apps/web/README.md).
- `packages/*`: the packages of Unframework, one job each (plan §5.2):

  | Package                             | Role                                                                                                                                                |
  | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `@unframework.dev/ir`               | The portable IR: plain-data types, builders, visitors and its generated JSON Schema.                                                                |
  | `@unframework.dev/diagnostics`      | The diagnostic type, the catalogue of stable `UF` codes, code frames, JSON and SARIF, fixes.                                                        |
  | `@unframework.dev/parser`           | Parses `.uf.tsx` with oxc and stylesheets with lightningcss. No TypeScript API.                                                                     |
  | `@unframework.dev/analyzer`         | Checks a parsed module and lowers its JSX into IR.                                                                                                  |
  | `@unframework.dev/codegen`          | The target kit: `defineTarget`, JS/JSX/markup printers, oxfmt formatting, the toolchain contract.                                                   |
  | `@unframework.dev/target-<name>` ×7 | One framework each: `emit()`, its capabilities, and a `/toolchain` entry that tests run it with.                                                    |
  | `@unframework.dev/compiler`         | `compile()`: the passes in order, for every selected target.                                                                                        |
  | `@unframework.dev/unplugin`         | The bundler plugin: `.uf.tsx` imports compile to the host framework, on Vite (tested) and every bundler unplugin offers, and the Astro integration. |
  | `@uxfront/unframework`              | The authoring API and the JSX types of `.uf.tsx` components.                                                                                        |
  | `@unframework.dev/testing`          | The cross-target test API, normalisation, the parity reporter. Private until M7.                                                                    |

- `tests/integration`: the corpus and its harness, which verify every case on every target. See [`tests/integration/README.md`](../tests/integration/README.md).
- `tests/toolchains/<name>`: the type checkers of each target's output, with TypeScript 6 where a checker still needs it.
- `tests/repo`: repo invariants, such as the package layering and the package template.
- `docs/adrs`: the architecture decision records. See [`docs/adrs/README.md`](../docs/adrs/README.md).

## Getting started

Node 24 or later. `packageManager` pins the pnpm version.

```sh
pnpm install   # also installs the Chromium build the browser tests run in
pnpm dev
```

## Scripts

| Command                        | Does                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `pnpm build`                   | Builds every workspace (`turbo run build`)                                               |
| `pnpm dev`                     | Runs every workspace's `dev` task                                                        |
| `pnpm check-types`             | Type-checks every workspace with TypeScript 7 (tsgo)                                     |
| `pnpm test`                    | Runs every workspace's tests, the integration corpus on all seven targets included       |
| `pnpm test:quick`              | Runs the changed packages' tests, the repo invariants and the corpus's `compile` project |
| `pnpm test:full`               | Runs what CI's test jobs run, before a pull request                                      |
| `pnpm test:update`             | Rewrites the corpus's golden outputs and shared expectations (refused in CI)             |
| `pnpm test:baselines`          | Rewrites the Linux screenshot baselines in Docker                                        |
| `pnpm test:baselines:download` | Copies in the Linux screenshot baselines that CI generated for the branch                |
| `pnpm test:canaries`           | Checks that every live test layer catches the corruption it exists for                   |
| `pnpm test:budgets:update`     | Rewrites the compile time and output size budgets (refused in CI)                        |
| `pnpm lint`                    | Lints the repo with oxlint (type-aware)                                                  |
| `pnpm format`                  | Formats the repo with oxfmt                                                              |
| `pnpm new:package`             | Creates a package from the package template                                              |
| `pnpm changeset`               | Records a change to a published package                                                  |

## Verifying a change

Use `pnpm test:quick` while you work. It runs the unit tests of the packages changed since the
merge base of `origin/main` and HEAD, the repo invariants and the corpus's `compile` project. It
runs no `browser:*`, `ssr:*` or `toolchain:*` project and no e2e app: those are for before a pull
request. Fetch `origin/main` first, or pass `--base <ref>` to compare with another branch.

A change to the compiler is done when the corpus is green on every target, not when it emits
code (plan P1). Before you open a pull request:

1. `pnpm check-types && pnpm lint && pnpm format:check`
2. `pnpm test:full`. It runs what CI's test jobs run: every package's tests, the whole corpus, the
   `bench` project, the e2e apps, the sample design system's tests and visual suite from
   tarballs, and the canaries when the branch changes a path on
   `CANARY_PATHS` (`tests/integration/scripts/canary-paths.ts`). It leaves out the CI jobs it
   can't stand in for, and `pnpm test:full --list` names each with its reason. The `bench` step
   measures each case's compile time against `basics/hello` in the same run, so run `test:full`
   with nothing else busy on the machine.
   The jobs it leaves out:
   - `check`: format, lint and types, which step 1 runs.
   - `changes`: CI's gate, which `test:full` reuses for the canaries alone.
   - `baselines`: it needs Docker. See step 4.
   - `parity`: it merges CI's artefacts. The corpus's own summary judges the local run.
   - `build` and `lighthouse`: they build and audit the docs site, not tests.
3. When a change is meant to change the output, run `pnpm test:update` and review every changed
   file under `tests/integration/cases`: the golden outputs and expectations are reviewed like
   code.
4. If the change touches what the browser renders, push it, and once CI's `Baselines` job has
   run, `pnpm test:baselines:download` copies in the Linux screenshots it generated.
   `pnpm test:baselines` (Docker) rewrites them locally. On macOS, the browser tests compare the targets with each other live, so a
   visual difference between targets fails locally without a baseline.

A new job in `.github/workflows/ci.yml` needs a step in `scripts/test-loop.ts`, or an entry with
its reason in that script's list of jobs left out, which this page names too. `tests/repo` fails
otherwise.

## Shared parts from uxfront

The shared configuration comes from the published `@uxfront/*` packages, not from copies:

| Package                                                                                                 | Where                                                    |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`@uxfront/oxlint-config`](https://www.npmjs.com/package/@uxfront/oxlint-config)                        | `oxlint.config.ts` (the `/vue` preset)                   |
| [`@uxfront/oxfmt-config`](https://www.npmjs.com/package/@uxfront/oxfmt-config)                          | `oxfmt.config.ts`                                        |
| [`@uxfront/typescript-config`](https://www.npmjs.com/package/@uxfront/typescript-config)                | Each package's `tsconfig.json` (see below)               |
| [`@uxfront/layer-ui`](https://www.npmjs.com/package/@uxfront/layer-ui), `@uxfront/ui`, `@uxfront/scene` | The homepage in `apps/web`, the same look as uxfront.com |
| [`@uxfront/layer-docs`](https://www.npmjs.com/package/@uxfront/layer-docs)                              | The documentation in `apps/web`, at `/docs`              |

## Adding a package

Every package follows one template (plan §5.2), and `tests/repo` fails a package that drifts from it:

- In the workspace, `exports` point at `src`; `publishConfig.exports` point at `dist`.
- [tsdown](https://tsdown.dev) builds it with `unbundle`, and `isolatedDeclarations` is on.
- Vitest runs its tests, from `test/`.
- Its `tsconfig.json` extends the repo's `tsconfig.base.json`.

Create one with the generator, then add it to the layer list in `tests/repo/test/layering.test.ts`:

```sh
pnpm new:package type-oracle "The TypeOracle interface and the syntactic resolver."
pnpm install
```

A package never imports a package on its own layer or above it, a target's main entry imports only
`@unframework.dev/ir` and `@unframework.dev/codegen`, and only the test toolchains load TypeScript's API.
Versions come from the `catalog:` in `pnpm-workspace.yaml`, which holds the plan's version
baseline.

## Releases

Published packages are versioned and released with [Changesets](https://github.com/changesets/changesets). See [`.changeset/README.md`](../.changeset/README.md).
