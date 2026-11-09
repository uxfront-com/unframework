# ADR-0077: Per-target packaging

- **Status:** Proposed
- **Date:** 2026-11-05
- **Plan:** §8.4, §9 M6; G2, P2; ADR-0016, ADR-0022, ADR-0027, ADR-0074, ADR-0076, ADR-0079

## Context

Plan §8.4 has `unframework build --package` run each framework's official packager, generate
`exports` for subpath packages and write barrels, so consumers of a published package get each
framework's native types. M6's exit installs the result from packed tarballs in seven apps
(ADR-0079). Two facts shape the work:

- **The packagers need TypeScript 6.** ng-packagr declares a peer of `typescript` `>=6.0 <6.1`,
  `@sveltejs/package` one of `^6.0.0`, and vue-tsc runs on TypeScript 6 here (ADR-0022). `AGENTS.md`
  keeps TypeScript 6 and Angular's compiler stack out of every package's dependencies.
- **Nothing publishes in M6.** Every package stays private at `0.0.0`.

This record is proposed before M6 builds it. Each section below is amended in place as its part is
built, and the targets stay in this order so that two sections never share a line.

## Decision

### Manifest

- `build --package` writes a publishable package to `<outDir>/package/`. Its manifest takes the
  `name`, `version` and `license` from the project's own `package.json`.
- The manifest has subpath `exports` (`./react`, `./vue`, …, and `./source/*` for the `.uf.tsx`
  sources), each packaged target's framework as an optional peer, and a barrel per target.
- A registry, `packages/cli/src/package/index.ts`, holds one line per target, each with a file of its
  own. The manifest lists the packaged targets in the registry's order, whatever order the config
  gives, and each packaged target's framework is its optional peer.
- `./source/*` holds the sources and the files under `srcDir` they read, so that they compile in a
  consumer's app.
- `package.targets` limits which targets are packaged.
- Each packager resolves from `package.resolveFrom` with `createRequire`: one path, or a path per
  target, with the project's root as the default. It's never a dependency of the CLI. Only that
  directory's `node_modules` chain counts, because pnpm's bin shims set `NODE_PATH` to every package
  a workspace hoists.
- A packager that isn't installed reports UF7008 `packager-missing`, and one that fails UF7009
  `packager-failed`. UF7008 also covers a target with no packager yet, and a project without the
  framework's types: tsgo and `vue-tsc` write declarations with `--noCheck`, so a return type would
  silently be `any`.
- Whether each packager and the framework's types resolve is checked before anything is written. The package is built in a
  scratch directory under `outDir`, and replaces the last good one only once every packager has passed.

### Angular

ng-packagr builds a standalone Angular Package Format into `dist/angular`. Its `exports["."]` merges
into the root manifest as `./angular`, with the paths prefixed again. A consumer fixture compiles
with ngc from `tests/toolchains/angular`.

### Astro

Astro ships the emitted sources, as §8.4 says. Astro's compiler builds them in the consumer's app.
`./astro` is the barrel itself, since Astro's own tooling reads the types from the sources.

### Qwik

A Vite library build with `qwikVite()` emits one `index.qwik.mjs` under the `qwik` export condition.
`qwikVite()` comes from `@qwik.dev/core/optimizer`, so `@qwik.dev/core` resolves from
`package.resolveFrom` beside `vite`. Vite doesn't read a `qwik` condition by itself, so `default` names
the same file.

The build runs in Vite's `lib` mode, which keeps every QRL inline for the app's optimizer to split. The
name `.qwik.mjs` marks the file for that optimizer, so a dynamic import stays in the one file instead
of becoming a chunk without the name.

Each sheet is inlined through the `?inline` import the target writes, and a passed-through module stays
an import (P7). `import.meta.env` also stays as written, because Vite would otherwise write this
build's values into the package, `VITE_` variables included (P8). The Qwik plugin that writes an app's
manifest and bundle graph is left out, since a library has neither and it warns on the console that
it found none.

The build reads none of the project's own configuration: no Vite config, `.env`, `tsconfig.json` or
PostCSS config. So the inlined sheet is the one the other targets ship, and the package depends only
on the sources and the Unframework config (P8).

`tsc`, resolved from `package.resolveFrom` too, writes the declarations with `noCheck`, for the reason
Vue's have it.

### React

tsdown builds JS and `.d.ts`, one module to a file. Bare imports, passed-through modules and sheets
stay as written, and each sheet is copied beside its importer: an output's imports aren't the package's
to bundle (P7), and tsdown's CSS support is a separate package. The declarations run apart and last, so
that a syntax error reaches Rolldown's error first. tsgo itself prints its errors and fails with only an
exit code, so a `tsc --declaration --noCheck` runs first with its output kept, for UF7009. Nothing
of the build's environment reaches the JS: `envPrefix` is empty (P8).

### Solid

tsdown builds JS and `.d.ts`, as React's do. A `"solid"` export condition also points at preserved
JSX, which the consumer's Solid compiler reads, on the server too. JSX means nothing without that
compiler and tsdown has none, so Babel with `babel-preset-solid` compiles the plain JS for the DOM.
Both resolve from `package.resolveFrom`, beside tsdown.

### Svelte

`@sveltejs/package`, §8.4's svelte-package, packages the emitted components. It keeps them as Svelte,
turns each `.ts` module into JS, and writes the declarations, so `./svelte` exports `types` and
`svelte`, as Svelte's packaging guide shows. It runs from the scratch directory, so a project's own
`svelte.config.js` isn't read.

It only warns of a declaration it couldn't write, and it transpiles a module without reading its
diagnostics, so both are made UF7009 here. The warning is read back, and `tsc --noCheck` parses the
`.ts` modules first, so `typescript` resolves from `package.resolveFrom` beside it. The peer range is
`^5.29.0`, the first release with the `{@attach}` the output uses.

### Vue

The package holds the SFC sources and `.ts` modules, with `vue-tsc` declarations beside them. `./vue`
names the declarations under `types`, and the barrel as written otherwise: an SFC needs the consumer's
compiler anyway, which also reads the TypeScript it imports. `vue-tsc` writes with `noCheck`, as tsgo
does for React and Solid: its scratch project can't see what the project declares, like a `virtual:`
module (ADR-0064) or a global, so a check there would refuse correct sources. A type a declaration can't
name is still UF7009.

## Consequences

**Positive:**

- A consumer installs one package and imports `<pkg>/vue`, with that framework's own types.
- Every packaged framework is an optional peer, so a React app installs no Svelte.
- `./source/*` lets one tarball serve both modes: a built target, or plugin mode through
  `@unframework/unplugin` (ADR-0075).
- TypeScript 6 stays where `AGENTS.md` allows it, because a project names where its packagers live.

**Negative:**

- A project has to install each target's packager, or limit `package.targets`.
- One package holds every target, so a packager that fails holds up the others (UF7009).
- ng-packagr's `exports` are ours to merge, so a change to its layout can break the `./angular`
  subpath. The consumer fixture catches it.

**Open:**

- Maps are proven on the plugin path only (ADR-0074). Packaged outputs, the Angular Package Format
  included, ship without proven maps, and a later issue proves them.

## Alternatives considered

- **Making the packagers dependencies of `@unframework/cli`.** That would bring TypeScript 6 and
  Angular's compiler stack into a package, against `AGENTS.md`'s rule and ADR-0022, and every user would
  install all seven.
- **One package per framework (`my-ds-react`, `my-ds-vue`).** A consumer's import names the framework
  either way, and seven packages would need seven versions and seven publishes.
- **Publishing only `.uf.tsx` sources.** Plugin mode can read them, but the Angular CLI has no plugin
  API (§8.2), so an Angular app needs a built package.
- **Our own bundle for every target.** §8.4 asks for each framework's official packager, because that
  is what a senior developer of that framework would ship (G2).
