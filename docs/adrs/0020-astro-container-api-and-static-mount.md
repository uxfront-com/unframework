# ADR-0020: Astro renders through the Container API, in Node and for the browser

- **Status:** Accepted (M0 spike)
- **Date:** 2026-10-01
- **Plan:** §9 (M0 spike 3); §5.5, §7.2, §7.3, §7.5, §8.2, R8, Appendix C

## Context

Astro 7 is the static target. It has no client runtime, so the interactive layers (L8, L9, L12)
are skipped by capability, but L3, L4, L6, L7, L10, L11 and L13 still apply (§7.2). §7.3 says SSR
runs through the Container API in Node and the browser project mounts the server HTML. Spike 3 had
four questions:

1. Can a Vitest node project import an `.astro` module that exists only as the unplugin's virtual
   id (`./Hello.uf.tsx` → `/abs/Hello.uf.tsx.astro`) and render it with props? What HTML comes back?
2. How does a browser project mount it, when the browser cannot run Astro and the spec is shared
   with six other targets?
3. How do we run Astro's own compiler and collect its errors and warnings?
4. How do we run `astro check` when the repo uses TypeScript 7?

Versions: astro 7.3.5 (with @astrojs/compiler-rs 0.5.1), vitest and @vitest/browser-playwright
5.0.3, playwright 1.63.0, vite 8.3.1, axe-core 4.13.0, typescript 7.0.2, @astrojs/check 0.9.10,
@astrojs/language-server 2.17.1 and @typescript/typescript6 6.0.2 (loading typescript 6.0.3). All
are Appendix C's, and none had to change.

## Decision

**L6, in Node.**

- The `ssr:astro` project is `getViteConfig(userViteConfig, astroInline)` from `astro/config`, used
  directly as an entry in `test.projects`. It returns a Vite `UserConfigFn`, which Vitest 5 accepts.
  - `userViteConfig` is
    `{ plugins: [unframework({ target: "astro" })], test: { name: "ssr:astro", environment: "node", … } }`.
  - `astroInline` is
    `{ root, configFile: false, logLevel: "warn", devToolbar: { enabled: false } }`. Without the
    toolbar setting every element gets `data-astro-source-file` and `data-astro-source-loc`.
- The unplugin (`enforce: "pre"`) resolves `X.uf.tsx[?query]` to `/abs/X.uf.tsx.astro[?query]`,
  keeping the query, and loads the Astro source. Its `load` returns null for Astro's own
  sub-requests (`/[?&]astro(&|=|$)/`, such as `?astro&type=style&index=0`) and also serves the bare
  `.astro` id, which Astro reloads through `server.pluginContainer`. Astro's `astro:build` transform
  then compiles it, because its filter `/\.astro$/` matches.
- Render with `experimental_AstroContainer` from `astro/container` (still the name in 7.3.5):
  `await AstroContainer.create()` once per module instance, then
  `container.renderToString(Component, { props, slots })`. The default `partial: true` gives a bare
  fragment; `partial: false` only prepends `<!DOCTYPE html>`.

**L7, L10, L11 and L13, in the browser.**

- **The import yields a reference.** In `browser:astro`, `import Hello from "./Hello.uf.tsx"` yields
  `{ __ufTarget: "astro", id: "/abs/Hello.uf.tsx.astro", name: "Hello" }`. The plugins are the
  unplugin, then `astroBrowserRef()` (`enforce: "pre"`, transform filter
  `/\.uf\.tsx\.astro(\?.*)?$/`), which replaces the module with that object, and a server-lifecycle
  plugin. Astro's own Vite plugins are never installed in a browser project.
- **Rendering is a browser command,** `ufAstroRender({ id, props, slots })`, run in Node:
  - It lazily creates one Vite server from the same `getViteConfig()`, plus
    `server: { middlewareMode: true, hmr: false, ws: false }`.
  - It imports `${ufFile}?container`, and the render helper with `astro/container`, through
    `server.environments.ssr.runner.import()`, so there is one copy of the Astro runtime.
  - It renders with `container.renderComponent()`, which prepends the component's `<style>` blocks,
    and returns `{ html, console }`. Payload and result are JSON-serialisable.
  - `configureVitest({ vitest }) { vitest.onClose(close) }` closes the server.
- **Mounting.** The adapter (`@unframework/testing/astro`, aliased per project) parses the HTML
  through a `<template>`, moves `<style>` elements to `<head>` and appends the markup to a
  `div[data-uf-root]`. It returns Vitest locators, the raw HTML and the captured console entries.
- **Hygiene.** The command patches `console.warn` and `console.error` around each render and
  serialises renders, because console is process-global. Astro's container logs through
  `createConsoleLogger({ level: "error" })`, so its own errors are captured too. The browser fails
  the hygiene layer on any entry.
- **Capability skips.** `it(name, requires("interactivity"), fn)` returns
  `{ skip: true, meta: { ufSkipReason } }`. Vitest 5's `skip` is boolean-only, so the reason travels
  in `meta` (a `TaskMeta` augmentation), which reporters read.
- **Dependency discovery.** The browser project sets `optimizeDeps: { noDiscovery: true, include }`,
  because Vite's scanner reads `.astro` ids from disk. ADR-0021's scan rule is the general fix;
  this spike did not run the two together.

**L3.** Call `transform()` from `@astrojs/compiler-rs` with Astro's own options: `compact: "jsx"`,
`internalURL: "astro/compiler-runtime"`, `resultScopedSlot: true`,
`scopedStyleStrategy: "attribute"`, a root-relative `normalizedFilename`, `sourcemap`, and
`resolvePath` when the output will be executed. Fail on any diagnostic of any severity and on any
`styleError`. Pin compiler-rs to the range astro 7.3.5 depends on (`^0.5.0`). ADR-0025 places this
in the L3 contract.

**L4.** A separate `tests/toolchains/astro` package holds `@astrojs/check` 0.9.10,
`@astrojs/language-server` 2.17.1 and `"typescript": "npm:@typescript/typescript6@6.0.2"`
(ADR-0022). Run once per tree, programmatically:
`new AstroCheck(root, require.resolve("typescript"), tsconfig).lint({})`, with the tsconfig
`include` covering `…/cases/**/__output__/astro/*.astro`. The CLI equivalent is
`ASTRO_TELEMETRY_DISABLED=1 astro check --noSync --tsconfig <file>`.

**Normalisation.** Strip bare `data-astro-cid-[a-z0-9]+` attributes, keeping
`scopedStyleStrategy: "attribute"` (with `"class"` the scope would mix into `class`). The codegen
never emits HTML comments, and Astro 7's default `compressHTML: "jsx"` applies JSX whitespace rules.

## Consequences

**Positive:**

- The node and browser projects compile the same code through Astro's real Vite pipeline. The
  `wrong-text` and `drop-attr` canaries each fail both L6 and L7, so the browser checks are not
  vacuous.
- Renders are deterministic, and so are compiles: the scope hash depends only on
  `normalizedFilename`, so it is stable across machines with the same root.

**Negative:**

- The command adds a second Vite server per browser worker process. A cold start took 266–811 ms,
  and a warm render about 0.5 ms. A virtual id has no file to watch, so the unplugin must call
  `this.addWatchFile()` for every real file the output depends on, or the server serves stale
  output.
- `@unframework/target-astro/toolchain` is more than Vite plugins. It exports `ssrProject()`,
  `browserPlugins()`, `browserCommands: { ufAstroRender }` and the browser `optimizeDeps` override.
- L3's zero-warnings check is vacuous for Astro for now: compiler-rs 0.5.1 emits only parser errors,
  and its upstream warning tests are skipped.
- `astro check` refuses TypeScript 7 and points to `@astrojs/ts-content-mapper` (0.2.0) for 7.1,
  which is the migration path (§5.5).
- The SSR string has bare attributes (`checked`), the browser's `innerHTML` has `checked=""`. The
  normaliser must treat both alike.

**Open:**

- Relative imports in Astro output resolve against the virtual id's directory, next to the
  `.uf.tsx`, not against `__output__/astro/`. Golden files that import CSS or child components will
  not resolve in place for L3 and L4. Settle before M3 and M4.
- `?container` inlines `<style>` blocks but not CSS imported in the frontmatter. For M4, either the
  codegen emits styles as `<style>` blocks or the command also collects the imported CSS.
- Until Astro emits warnings, should L5 (eslint-plugin-astro) or an HTML validator cover them?
- The dedicated server's memory and cold start under sharded CI with many workers.

## Alternatives considered

- **`getViteConfig()` in the browser project.** In the `client` environment Astro's transform
  replaces every `.astro` module with a stub that throws
  `Astro components cannot be used in the browser`. In dev it also adds a catch-all
  `astroDevHandler` middleware and `appType: "custom"`, which would compete with Vitest's browser
  server.
- **Rendering through the `ssr:astro` project's server.** It works only when both projects are
  selected, which breaks `--project browser:astro` and sharded CI.
- **Prerendering in `globalSetup`, or in the unplugin's `load`.** Props live in the spec, so neither
  knows the (component, props) pairs, and neither can return per-render console output. Spike 1's
  `.uf.tsx.static.js` slot exported hand-written HTML; rendering inside `load` was not tried.
- **Importing `astro/container` natively in the command.** It works for static components, but
  Astro's config inlines the `astro` package, so it would load a second runtime: 153 `astro/dist`
  modules were transformed in the node project and 314 in the command server.
- **Skipping Vite: compile with compiler-rs, write an `.mjs`, import it and render.** It works if
  `resolvePath` is passed; without it the output imports `createMetadata`, which
  `astro/compiler-runtime` does not export. It bypasses style preprocessing, `?container` and the
  resolution of imported `.astro` and CSS files, so it stays a tool for quick probes.
- **The `astro check` CLI.** It works (exit 1, 2 errors) but only prints. `AstroCheck` returns
  structured diagnostics with LSP ranges, which the parity matrix needs.

## Evidence

- **`pnpm exec vitest run`, three projects:** `Test Files 7 passed (7)`,
  `Tests 24 passed | 1 skipped (25)`, about 3.4 s wall.
- **`ssr:astro` raw output:** `<p class="greeting">Hello, world!</p>`; with `{ name: "Astro" }`,
  `Hello, Astro!`; a name of `<b>&"'` gives `Hello, &lt;b&gt;&amp;&quot;&#39;!`. A scoped component
  gives
  `<section class="card" data-astro-cid-c7yaimas><!-- a comment authored in the template --><h2 data-astro-cid-c7yaimas>Title</h2>…`,
  with void elements unslashed. `renderComponent` with `?container` prepends
  `<style>.card[data-astro-cid-c7yaimas] {…}</style>`. Two renders give identical strings.
- **`browser:astro`:** `3 passed | 1 skipped`. For hello, `getByText` is visible, the normalised DOM
  equals `__expected__/ssr.named.html`, `toMatchAriaInlineSnapshot('- paragraph: Hello, Astro!')`
  passes, a screenshot is taken, axe reports 0 violations and `view.console` is `[]`. For
  nested-and-void, the computed `padding-top` is `8px`, the checkbox is checked and disabled, and
  the ARIA snapshot is `heading "Title" [level=2]`, `paragraph: Line one Line two`,
  `checkbox "Agree" [checked] [disabled]`. The noisy case returns
  `[{level:"warn",message:"uf-noisy warn: Press"},{level:"error",message:"uf-noisy error: Press"}]`.
  The JSON reporter shows `meta: {"ufSkipReason":"capability: astro lacks interactivity"}`.
- **Without `noDiscovery`:**
  `[plugin vite:dep-scan:load:html] Error: ENOENT … NestedAndVoid.uf.tsx.astro`, then
  `optimized dependencies changed. reloading`, then
  `TypeError: Failed to fetch dynamically imported module`.
- **Canaries:** `UF_CANARY=wrong-text` failed 3 tests (2 ssr, 1 browser), `UF_CANARY=drop-attr`
  failed 2 (1 ssr, 1 browser).
- **`toolchain:astro`:** 13 passed. The golden outputs compile with no diagnostics. A broken
  template gives `Expected corresponding JSX closing tag for 'p'.` at 5:41 and `Unexpected token` at
  6:0; `transform` does not throw. Two compiles give the same `code`, `map`, `css` and `scope`.
- **Warnings:** 17 suspicious inputs, including `client:load` on a `<div>`, `<script define:vars>`,
  `set:text` with children and an unterminated frontmatter, all returned `diagnostics=[]`.
- **`AstroCheck` on TypeScript 6** (`require("typescript").version` is `6.0.3`): exactly two
  `ts(2322)` errors on the broken fixtures (one is `<Hello name={42} />`), 0 on the clean tree and
  0 on the cases' golden outputs. The CLI printed `Result (4 files): 2 errors, 0 warnings, 0 hints`
  and exited 1. `--root src/ok` still checked 4 files; `--tsconfig tsconfig.ok.json` checked 2.
- **`astro check` on `typescript@7.0.2`:** exit 1, with
  `[ERROR] [check] astro check does not currently support TypeScript 7.0.`, pointing to
  `@astrojs/ts-content-mapper`.
- **Probes:** `compact: "jsx"` collapses whitespace by JSX rules and keeps `<pre>` verbatim.
  Attributes: `checked` stays bare, boolean `aria-*` and `data-*` become `"true"`/`"false"`,
  `class=""` becomes a bare `class`, `<path/>` becomes `<path></path>`, and a style object becomes
  `style="color:red;margin-top:1px"`. Imported CSS was missing from `?container`, and a
  golden-relative import failed with `Failed to load url ../../Styled.css`. The command served
  `<p>v1</p>` cold in 266–811 ms and warm in 0.3–0.6 ms, and `<p>v2</p>` after an edit, but still
  `<p>v1</p>` with `addWatchFile` removed.
- **`pnpm typecheck`** (tsgo 7.0.2 over the harness, configs and the L3 test): exit 0.
