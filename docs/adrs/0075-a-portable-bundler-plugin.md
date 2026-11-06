# ADR-0075: A portable bundler plugin, tested on Vite

- **Status:** Proposed
- **Date:** 2026-11-05
- **Plan:** §8.2, §9 M6; P2, R12; ADR-0021, ADR-0026, ADR-0053, ADR-0063, ADR-0074; defers
  ADR-0027's "(M6)" step, and uses `hotUpdate` where ADR-0071 names `handleHotUpdate`, without
  editing either record

## Context

M6's scope is "the unplugin on every bundler, plus the Astro integration, and HMR". Today every hook
in `@unframework/unplugin` sits under `vite:`, and the factory throws for any other bundler.

ADR-0071 leaves hot updates and the other bundlers to M6. ADR-0026 asks the plugin to check the
framework plugin's whitespace option when it lands for applications. ADR-0063 leaves the edge from
an author's stylesheet to its sheet module to M6.

The project's owner chose to use unplugin's generic hooks, test on Vite, and trust the other
bundlers to work by default. So this record narrows plan §8.2's list of bundlers to entries we
provide and don't test.

It differs from two accepted records, and edits neither. It defers ADR-0027's "(M6)" step for
applications (Alternatives), and it uses Vite's `hotUpdate` where ADR-0071 names `handleHotUpdate`.

This record is proposed before M6 builds it. Each section below is amended in place as its part is
built.

## Decision

### Portable hooks

- `resolveId`, `load`, the watch edges and the guard's `transform` move to unplugin's generic hooks,
  and a new `watchChange` calls `project.update` through the same hand-over a load does, so a file
  no compile read, or one that holds what the project holds, changes nothing.
- Only `configResolved`, the scan branch, environments and `api` stay under `vite:`. unplugin copies
  `vite:` over the generic hooks, so a `vite:` `resolveId`, `load` and `transform` replace them there:
  each calls the same function, with Vite's `scan` or its environment's verdicts. A bundler with no
  environments has one set of verdicts.
- The generic `resolveId` uses `this.resolve` where the context has one, as Rollup's, Rolldown's and
  Vite's do. Without it, as on esbuild and webpack, a specifier must be a path to the file. An alias or a
  package's specifier is left to the bundler.
- `this.error` throws on Rollup's family, and fails webpack's build through `emitError`. esbuild only
  records the message, and drops it when `load` returns no code or a `transform` follows, which would
  build a failed module as the authored file. So `load` throws on esbuild too (P2).
- The root comes from Vite's config, webpack's or Rspack's `compiler.context`, esbuild's
  `absWorkingDir`, or else `process.cwd()`.
- The Vite-only throw goes.
- There's one entry per factory unplugin 3.4 exports, each a one-line file: `./bun`, `./esbuild`,
  `./farm`, `./rolldown`, `./rollup`, `./rsbuild`, `./rspack`, `./unloader`, `./vite` and
  `./webpack`. `./vite` keeps its doc comment and its type exports, which the harness imports.
- A test creates a plugin from every entry, with `Bun` stubbed, since unplugin's Bun factory refuses
  to run outside Bun. Only Vite runs end to end.

### Detection and maps

- With `target` omitted, Vite's `configResolved` detects the target from the plugin names:
  `vite:vue`, `vite-plugin-svelte`, `vite:react-*`, `solid`, `vite-plugin-qwik`, `astro:*` and
  `@analogjs/vite-plugin-angular`. Until the target is known, the filters match every target's suffix.
- No match reports UF7005 `target-not-detected`, and two matches UF7006 `target-ambiguous`.
- plugin-vue's resolved `template.compilerOptions.whitespace` of `"preserve"` reports UF7010
  `host-option-incompatible`, because the printer's layout assumes `condense` (ADR-0026).
- `load` returns `{ code, map }` from `compile({ sourceMap: true })` (ADR-0074). `assemble.ts` moves
  to MagicString to join modules, so the maps stay valid.

### Astro integration

- `@unframework/unplugin/astro` is an Astro integration, in `src/astro.ts`. In `astro:config:setup`
  it calls `updateConfig({ vite: { plugins: [unframework({ target: "astro", ...options })] } })`. Its
  options are the plugin's, without `target`.
- The same call adds `optimizeDeps: { entries: ["!**/*.uf.tsx"] }`. Astro's scan entries match every
  `.tsx` file under `src`, and the scan would read a `.uf.tsx` file as plain JSX. Without React's JSX
  runtime installed, the scan would fail with an error, and Vite would lose the dependencies it would
  have found, pre-bundling those only as requests reach them.
- In `astro:config:done` it reports UF7010 when the final `compressHTML` isn't `"jsx"`, Astro's
  default, because the printer's layout assumes it (ADR-0026). The hook runs after every
  integration's `astro:config:setup`, so it sees what a later integration set. The warning goes to
  Astro's logger, with no span, because a configuration has no source to point at.

### Hot updates

- Vite's `hotUpdate` runs `project.update([file])`, and handles `create` and `delete` as well as
  `update`. The hook takes over from the `handleHotUpdate` ADR-0071 names.
- For an edited stylesheet, it adds the sheet modules of every component that imports it
  (`<abs>.uf.tsx.css`, plugin-vue's style queries included), so Vite applies a CSS update.
- It drops our virtual modules from `modules` when early cutoff recompiled nothing (ADR-0071).
- A framework's HMR stays the framework's own. React, Vue, Svelte and Solid send an update. Qwik and
  Astro do a full reload with the new content.

### Packages that ship sources

- A bare import that resolves to a `.uf.tsx` or `.uf.ts` inside `node_modules`, through `exports`
  and `./source/*` included, compiles like a local one.
- Such a file stays out of the dependency optimiser and is `noExternal` for SSR, with the package's
  root as the project root of its graph.

## Consequences

**Positive:**

- One plugin serves each bundler unplugin knows, and only Vite keeps extras of its own.
- An app that names one framework plugin needs no `target`.
- Whitespace settings that would change the DOM become a warning at the start, not a parity bug.

**Negative:**

- Nine of the ten entries are untested, so one can fail at build time with no diagnostic of ours.
- Detection reads plugin names, which are a framework plugin's own and can change. The detection
  tests fail if one does.
- `tests/integration` runs the corpus through the plugin, so a port that changes `load` shows up in
  every browser project.

**Open:**

- Whether the portable `load` keeps `this.error`'s behaviour on bundlers other than Vite. Nothing
  tests it.

## Alternatives considered

- **Analog plugin mode in M6: deferred.** ADR-0027 says that for applications (M6) "the unplugin's
  Angular path ships the same ngtsc step ahead of Analog". The project's owner agreed to defer that
  step, so `ngtscVirtual` stays in `@unframework/target-angular/toolchain`, and M6's Angular app
  uses the packed package. ADR-0027 and ADR-0021 stay as written, and a later issue ships the step.
  Detection still names `angular` when it finds Analog, and such an app adds `ngtscVirtual` itself,
  as the harness does.
- **A refusal matrix of framework and bundler pairs, with a UF7 error for each unsupported pair.** It
  would be loud (P2), but it needs a test per pair to stay true, and the owner chose to trust the
  defaults.
- **Keeping the hooks under `vite:` and adding others beside them.** Each bundler would then have its
  own copy of `resolveId` and `load`, and the copies would drift.
- **Meta-framework integrations (Nuxt, SvelteKit, SolidStart, Qwik City).** They're out of M6, and
  M6's apps are plain Vite apps, an Astro app and an Angular CLI app (ADR-0079).
