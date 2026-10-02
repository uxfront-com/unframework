# ADR-0022: TypeScript 6 checkers live beside TypeScript 7

- **Status:** Accepted (M0 spike), amended by ADR-0028
- **Date:** 2026-10-01
- **Plan:** §9 (M0 spike 5); §5.2, §5.5, §7.2 (L4), §7.3, §7.9, R8, Appendix C

## Context

The repo runs TypeScript 7.0.2 (tsgo). Its `typescript` package's main export is only
`lib/version.cjs`: there is no JS API. tsgo checks the TSX outputs (React, Solid, Qwik), but the
other checkers still need TypeScript 6's API (§5.5, R8):

- vue-tsc 3.3.11, svelte-check 4.7.6 and `astro check` (@astrojs/check 0.9.10)
- ngc (@angular/compiler-cli 22.2.1, peer `typescript >=6.0 <6.1`)
- at test time, Analog (`@analogjs/vite-plugin-angular` 2.7.5) and `@angular/build` 22.2.0, which
  compile Angular inside Vite (ADR-0021)

§5.2 confines TypeScript 6 to `tests/toolchains/*` and lets targets depend only on `ir` and
`codegen`. Everything else keeps TypeScript 7, including the root `tsc` and type-aware oxlint. The
spike's scratch workspace mirrored the repo (`packages/*`, `tests/*`, `tests/toolchains/*`) on
pnpm 11.25.0 and Node 24.21.0.

## Decision

1. **The TypeScript 6 alias is `"typescript": "npm:@typescript/typescript6@6.0.2"`,** a
   devDependency of `tests/toolchains/{vue,svelte,astro,angular}` only. The wrapper's only bin is
   `tsc6`, so `tsc` stays TypeScript 7 everywhere, and vue-tsc 3.3.11 detects the wrapper
   (`resolveTscPath` → `@typescript/old/lib/tsc`). The wrapper's own dependency,
   `@typescript/old: npm:typescript@^6`, floats, so a root override pins the real compiler.
2. **`tests/toolchains/{react,solid,qwik}` declare `"typescript": "7.0.2"`,** the root's instance.
3. **Framework runtimes and types live in `tests/integration`,** next to the `__output__` trees,
   because every checker resolves `react`, `vue`, `@angular/core` and the rest from the output
   file's location. The exceptions are peers each checker needs beside it: `svelte` for
   svelte-check, `astro` for `astro check`, `@angular/compiler` for ngc.
4. **Each `tests/toolchains/<target>` holds a checker, a tsconfig and one `check` script.** The
   tsconfig's `include` reaches `../../integration/cases/**/__output__/<target>/**`, so there is one
   checker run per target.
5. **Angular's build stack lives only in `tests/toolchains/angular`:** Analog,
   `@angular/build`, `@angular/compiler-cli`, `@angular/compiler`, vite and the alias.
   `packages/target-angular` depends on none of them, not even as optional peers. Its `./toolchain`
   entry exports `vitePlugins({ tsconfig, resolveFrom })`, which loads Analog lazily through
   `createRequire(join(resolveFrom, "package.json"))` and `import()` and returns
   `[Promise<Plugin[]>]`; Vite awaits promises in `plugins`. The harness passes
   `resolveFrom: tests/toolchains/angular`, and a user's project would pass its own root.
6. **`packageExtensions` gives Analog a `typescript` peer.** Analog imports `typescript` without
   declaring it, so it would otherwise walk up to the root's TypeScript 7.
7. **Analog gets its own tsconfig** (`tests/integration/tsconfig.angular.json`) without `noEmit`.
   With `noEmit: true` it silently emits a 0-byte chunk.

The workspace file, without its catalog:

```yaml
packages:
  - "packages/*"
  - "tests/*"
  - "tests/toolchains/*"
allowBuilds:
  esbuild: true
  "@parcel/watcher": false # optional native deps of @angular/build (prebuilt binaries)
  lmdb: false
  msgpackr-extract: false
overrides:
  "@typescript/typescript6>@typescript/old": "npm:typescript@6.0.3"
packageExtensions:
  "@analogjs/vite-plugin-angular@2":
    peerDependencies:
      typescript: ">=6.0 <6.1"
peerDependencyRules:
  allowedVersions:
    "@qwik.dev/core>vitest": "5" # Qwik beta.47's optional peer is ">=2 <5"
minimumReleaseAgeExclude: # written by pnpm 11 itself on a fresh resolve (default gate)
  - "@angular/common@22.2.1"
  - "@angular/compiler-cli@22.2.1"
  - "@angular/compiler@22.2.1"
  - "@angular/core@22.2.1"
  - "@angular/platform-browser@22.2.1"
  - "@qwik.dev/core@2.0.0-beta.47"
```

The catalog holds Appendix C's exact versions.

| Toolchain | `check` script                                               | Notable tsconfig settings                                                                                                    |
| --------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| React     | `tsc --noEmit -p tsconfig.json`                              | `jsx: "react-jsx"`, `moduleResolution: "bundler"`                                                                            |
| Solid     | `tsc --noEmit -p tsconfig.json`                              | `jsx: "preserve"`, `jsxImportSource: "solid-js"`                                                                             |
| Qwik      | `tsc --noEmit -p tsconfig.json`                              | `jsx: "react-jsx"`, `jsxImportSource: "@qwik.dev/core"`                                                                      |
| Vue       | `vue-tsc --noEmit -p tsconfig.json`                          | `vueCompilerOptions: { strictTemplates: true }`                                                                              |
| Svelte    | `svelte-check --tsconfig ./tsconfig.json --fail-on-warnings` | `verbatimModuleSyntax`, `include` `**/*.svelte`                                                                              |
| Astro     | `astro check`                                                | `extends: "astro/tsconfigs/strict"`, `exclude: []`                                                                           |
| Angular   | `ngc -p tsconfig.json --pretty false`                        | `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers`, `extendedDiagnostics.defaultCategory: "error"` |

Every toolchain tsconfig also sets `strict`, `noEmit`, `skipLibCheck` and `types: []`.

## Consequences

**Positive:**

- One `pnpm install --frozen-lockfile` serves everything, with `pnpm peers check` and
  `pnpm dedupe --check` clean.
- Every TypeScript 6 consumer (vue-tsc, svelte-check, @astrojs/check, both `@angular/compiler-cli`
  instances, Analog and `@angular/build`) sees `ts.version` 6.0.3, and the root sees 7.0.2.
- Root type-aware oxlint and tsgo `check-types` over `packages/*` are unaffected: tsgolint embeds
  typescript-go.
- All seven checkers pass the clean tree and fail on a script-level type error (TS2322 everywhere)
  and a template-level one (TS2304 for the TSX targets, Svelte and Astro; TS2339 for Vue and
  Angular).
- Moving a checker to TypeScript 7 (a content mapper, or Angular's ngp) means deleting its alias
  line and switching its script.

**Negative:**

- The Angular toolchain is a promise inside `plugins`, typed with a structural `AnalogOptions`, and
  the harness must pass `resolveFrom`.
- `target-angular` cannot declare its peers in the workspace: pnpm 11's default `autoInstallPeers`
  installs a workspace package's own optional peers against the root's TypeScript 7, making them
  unmet again. The peer metadata is added at publish time (M6).
- vue-tsc exits 2 on type errors and the others exit 1, so the harness treats any non-zero exit as
  failure.
- `astro check` runs `astro sync` first, which writes `<toolchain>/.astro/`; gitignore it, with
  Analog's output and `__canary__` directories. Without a `.gitignore` covering `node_modules`, root
  oxlint walked into the packages' `node_modules` for 96 s until tsgolint died with SIGPIPE.
- Incremental installs keep stale peer resolutions. Verify a topology change from a deleted lockfile
  and no `node_modules`.

**Open:**

- Turbo `check` tasks read files outside their package, so their `inputs` need
  `$TURBO_ROOT$/tests/integration/cases/**/__output__/<target>/**`. The turbo 2.11.5 docs support
  it; the spike did not exercise it.
- Whether all seven `/toolchain` entries load lazily from `resolveFrom`, or only Angular's.
  `target-vue`'s static import of `@vitejs/plugin-vue` was only type-checked.
- Report upstream that Analog imports `typescript` without declaring it.

## Alternatives considered

Each topology was checked from a fresh lockfile.

- **A. Analog and `@angular/*` as devDependencies of `packages/target-angular`, no TypeScript 6
  there.** The peers resolve from the workspace root: `unmet peer typescript … Installed: 7.0.2`,
  and the Vite build fails at config load with `TypeError: ts.createPrinter is not a function`.
- **B. `packageExtensions` adding `dependencies.typescript` to `@angular/build` and
  `@angular/compiler-cli`.** A declared peer wins, so they still get 7.0.2. It does work for
  Analog, which declares nothing.
- **C. `overrides` such as `"@angular/build>typescript"`.** They do not change peer resolution.
- **D. Option A plus the alias in `packages/target-angular`.** It works, and `tsc` there is still
  7.0.2, but it puts TypeScript 6 and the Angular build stack into a `packages/` manifest, breaking
  §5.2. It is the fallback if lazy loading proves awkward.
- **`npm:typescript@6.0.3` or plain `6.0.3`.** Every checker and Analog work with either, and the
  lockfiles differ only in the specifier. But each toolchain's `.bin` gains TypeScript 6's `tsc` and
  `tsserver`, which shadow tsgo there (`pnpm exec tsc -v` → `Version 6.0.3`).
- **`dependenciesMeta.injected` for `target-angular`.** Not tried within the timebox. Injected
  packages are copies, which defeats `exports` → `src` live editing.
- **`autoInstallPeers: false`.** It changes peer handling workspace-wide.

## Evidence

- **`pnpm install --frozen-lockfile`** after removing every `node_modules`: done in 2.9–3.2 s.
  `pnpm dedupe --check` was clean after one `pnpm dedupe` (rolldown 1.2.8 → 1.2.11 under
  `@angular/build`'s exact vite 8.3.0).
- **Which TypeScript each tool loads:** the root `typescript@7.0.2` (`API=false`); vue-tsc,
  svelte-check, @astrojs/check, `@angular/compiler-cli`, Analog and `@angular/build` the wrapper
  6.0.2 with `ts.version=6.0.3` (`API=true`); `tests/integration` 7.0.2.
- **`pnpm exec tsc -v`:** 7.0.2 in every package, including the TypeScript 6 toolchains, whose
  `.bin` holds `tsc6` (for example `ng-xi18n ngc tsc6 vite`).
- **Checkers, direct binary, warm, in ms:**

  | Target  | Clean     | Script canary (exit, error) | Template canary (exit, error)               |
  | ------- | --------- | --------------------------- | ------------------------------------------- |
  | react   | 87–461    | 1, TS2322                   | 1, TS2304 `greet`                           |
  | solid   | 68–117    | 1, TS2322                   | 1, TS2304                                   |
  | qwik    | 98–143    | 1, TS2322                   | 1, TS2304                                   |
  | vue     | 441–622   | 2, TS2322                   | 2, TS2339 `greet` (strictTemplates)         |
  | svelte  | 381–556   | 1, "not assignable"         | 1, "Cannot find name 'greet'"               |
  | astro   | 1176–1909 | 1, ts(2322)                 | 1, ts(2304)                                 |
  | angular | 497–676   | 1, TS2322                   | 1, TS2339 "does not exist on type 'Canary'" |

- **101 case trees through `pnpm run check`:** react 614 ms, solid 634, qwik 660, vue 1194,
  svelte 1101, astro 3362, angular 1130, all exit 0. `pnpm run` itself adds about 450 ms.
- **Vitest `toolchain:<target>` × 7:** 7 passed, Duration 1.73–1.92 s, 4.6 s wall.
- **Angular at runtime:** `vite build` in `tests/integration` through
  `@unframework/target-angular/toolchain` with `resolveFrom` set built in 248–289 ms, 0.85 kB,
  containing `ɵɵdefineComponent` and `hostAttrs [2,"display","contents"]`.
- **Root oxlint** (1.86.0 with oxlint-tsgolint 7.0.2003, `typeAware: true`) exited 0 in 0.7 s and
  reported injected floating promises in `packages/target-vue/src` and in `__output__`.
- **Negative findings:** moving `@types/react` to `tests/toolchains/react` failed the React check
  with TS7016 and TS7026 on `react/jsx-runtime`. `minimumReleaseAge: 0` made a fresh resolve fail
  with `ERR_PNPM_NO_MATCHING_VERSION @shikijs/langs@4.5.0`, published 30 s earlier. Without the
  `allowBuilds` entries, `pnpm install` exits 1 with
  `ERR_PNPM_IGNORED_BUILDS: @parcel/watcher, lmdb, msgpackr-extract`, and every `pnpm run` then
  fails too, because it re-runs install.
