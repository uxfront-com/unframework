# ADR-0082: Vue builds on TypeScript 7 without `script.fs`

- **Status:** Accepted
- **Date:** 2026-11-11
- **Plan:** §8.2, §8.4, §9 M6; P7, P8; ADR-0067, ADR-0075, ADR-0077, ADR-0079; amends ADR-0067,
  ADR-0077 and ADR-0079

## Context

A Vue output keeps `defineProps<X>()` when `X` comes from a relative module (ADR-0067). Vue's
`compileScript` reads that module through its `fs` option, or through TypeScript's `sys` without
one, and `@vitejs/plugin-vue` passes only the app's own `script` options. TypeScript 7's
`typescript` module exports only `version` and `versionMajorMinor`, so on TypeScript 7 every such
component fails with "No fs option provided to `compileScript` in non-Node environment". ADR-0067
left the fix to the app, as a `script.fs` in plugin-vue's options, and the Vue e2e app passed one
in both modes (ADR-0079).

A Vue app set up as the docs show, with `unframework()` and `vue()`, so failed to build on
TypeScript 7. Plugin mode failed on a `.uf.tsx` whose props type is imported, and package mode
failed too: ADR-0077 shipped the SFC sources, which the consumer's plain `vue()` compiles with the
same missing file system. Vue 3.5.45 still falls back to `sys`.

A relative import needs only `fileExists`, `readFile` and `realpath`. Vue outputs never import a
package's type (ADR-0067 prints a fallback for that), so Node's file system is all they need.

## Decision

- **Plugin mode: the plugin fills `script.fs`.** On Vite, when the target is `vue`, detected or
  given, `configResolved` finds the `vite:vue` plugin and, if its `script.fs` is unset, gives it
  Node's file system through `api.options`, the surface UF7010 already reads. It replaces the
  options through plugin-vue's setter and never changes the app's object. An app's own `script.fs`
  stays. plugin-vue's `configResolved` rebuilds its options from the current ones, so the fill holds
  in either plugin order. It reaches every SFC plugin-vue compiles, the app's own `.vue` files too.
- **The file system** behaves as TypeScript's `sys` does: a directory is no file, a missing file
  reads as `undefined`, and a path that can't be resolved is its own real path. Any other error
  throws. It fills on every TypeScript version, since on TypeScript 6 it reads what `sys` would.
- **Package mode: the Vue packager compiles the SFCs.** It runs a Vite library build through
  plugin-vue, as Qwik's packager runs `qwikVite()`, with one module to a file under the stage's
  `vue/`. A component is `Card.vue.js`, beside `vue-tsc`'s `Card.vue.d.ts`, and Vite splits its
  `<script setup>` into `Card.vue_vue_type_script_setup_true_lang.js`. `.ts` modules are `.js`. The
  package holds no `.vue` file, so a consumer's plugin-vue compiles nothing of it.
- `./vue` is `{ "types": "./vue/index.d.ts", "default": "./vue/index.js" }`.
- **No runtime (P7).** Each module imports only `vue`, its own modules, its passed-through modules
  as written and its sheet, which is copied beside it and imported as `import "./Card.uf.tsx.css"`,
  as React's and Solid's are. A style request other than an unscoped `<style src>` fails the pack.
- **Deterministic (P8).** The compile is for production whatever `NODE_ENV` says, so no file path
  or devtools hook is attached. `import.meta.env` stays as written, the project's Vite config,
  `.env` and PostCSS config are shut out, as Qwik's are, and Rolldown attaches no debug comments.
- The build passes plugin-vue the same file system, so packing works when the `vue` it compiles
  with sits beside TypeScript 7. That `vue` resolves from the stage under `outDir`, the one its
  declarations read.
- `vite` and `@vitejs/plugin-vue` join `vue-tsc` in what the packager needs from
  `package.resolveFrom` (UF7008).

**What it amends.** ADR-0067's consequence that a Vue project on TypeScript 7 needs `script.fs`
holds only outside Vite's plugin. ADR-0077's Vue section ships JS and declarations, not SFC sources.
ADR-0079's `vue` app passes no `script.fs` in either mode.

## Consequences

**Positive:**

- A Vue app on TypeScript 7 builds with `unframework(), vue()` in plugin mode and plain `vue()` in
  package mode, and a consumer needs no option.
- The app's own `.vue` files that import a props type compile on TypeScript 7 too.
- A packaged Vue component is plain JS, as a Vue library built with Vite is, so the consumer
  compiles none of it.

**Negative:**

- A compiled package loses Vue's dev-only prop warnings, and its render code is the DOM's, which
  Vue's server renderer renders without its SSR-optimised path. Every Vue library built in Vite's
  library mode makes this trade, and no e2e app renders Vue on the server.
- The package is compiled with the `vue` resolved when it's packed, and its peer stays `^3.5.0`, so a
  design system should pack with the lowest Vue 3.5 it supports.
- `api.options` is a public but loosely typed surface. A later plugin-vue without its setter would
  make the fill do nothing, which the Vue e2e app, on TypeScript 7 with no `script.fs`, would catch.
- Webpack, Rspack and the other bundlers get no fill. Only Vite is tested (ADR-0075).

## Alternatives considered

- **Document the option (PR #147).** Every Vue app on TypeScript 7 would have to find and copy the
  same block, and package mode would still fail in a consumer that hadn't.
- **Print every imported props type inline.** It would change the golden output of every cross-file
  case and drop the author's type names, against G2 and ADR-0067.
- **A fix in Vue.** It would help only consumers on the release that has it.
- **Call `compileScript` directly when packing.** plugin-vue already joins the script, the template
  and the styles as a Vite app expects, and a second assembly would drift from it.
- **Fill only on TypeScript 7.** It would mean reading the app's TypeScript version, and on
  TypeScript 6 Node's file system reads what `sys` would anyway.
