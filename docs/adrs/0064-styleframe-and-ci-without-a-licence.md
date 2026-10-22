# ADR-0064: Styleframe passes through, and CI needs no licence

- **Status:** Proposed
- **Date:** 2026-10-22
- **Plan:** §4.4, §5.7, §7.3, §9 M4, G7, P2, P7, P8, R11; C4 (ADR-0004), D11 (ADR-0015); amends
  ADR-0015; builds on ADR-0063

## Context

Plan §4.4 and ADR-0004 make Styleframe's recipes and tokens ordinary imports,
`import { button } from "virtual:styleframe"`, passed through to every target and resolved by
Styleframe's own plugin. ADR-0063 left the analyser rejecting them, and catalogued UF5006 for what
it can't pass through. M4 also has to settle R11: "Styleframe builds require a licence", with "a CI
licence or a deterministic stub".

- Styleframe's recipe module is TypeScript its plugin generates. A recipe call returns its class
  names at run time, through `createRecipe` from `@styleframe/runtime`, so a styled output imports
  something besides its framework, which P7 and ADR-0015 rule out.
- Styleframe's licence check (`validateInstanceLicense` in `@styleframe/license` 2.0.2) acts only
  on an instance a Pro feature has flagged (`__licenseRequired`). With no key, it warns in
  development, and fails only a production build of a flagged instance. Community Styleframe never
  needs a key.
- A stub that writes no CSS can't prove pixel parity (§7.6), so the visual layers need the real
  plugin.

## Decision

- **Two forms pass through.** Named imports from `virtual:styleframe`, called in a `class` part
  (`class={button({ size })}`, alone, in an array or in a conditional), and the side-effect import
  `virtual:styleframe.css`. The IR holds them as `passThroughImports`, and a call as an `Import`
  reference. Every output imports them as written, with the source's local names, and the
  template reads them as written. Angular reads a recipe through a protected member, as it reads a
  global.
- **Anything else is UF5006** at its span: a default, namespace or type-only import, an import of
  another `virtual:styleframe…` module, a recipe read outside a `class` part (a toggle's condition,
  setup code, `?.`), and a recipe nothing reads, whose import would reach every output unused.
- **Styleframe's plugin resolves them.** The unplugin leaves `virtual:styleframe*` alone, so the
  two plugins can sit in either order. We list Styleframe's first, as its installation guide does.
- **The runtime import is the one exception to P7.** A styled output's `virtual:styleframe`
  resolves to a module that imports `@styleframe/runtime`. The output itself still names only its
  framework and Styleframe's two virtual modules, and each target's L5 allow-list names them too.
  Compile-time folding of recipe calls, which would drop the runtime, is a proposed issue.
- **The test projects run Community Styleframe.** One configuration,
  `tests/integration/styleframe.config.ts`, holds the corpus's tokens, utilities, recipes and
  themes, built with `@styleframe/theme`. Every ssr and browser project loads
  `styleframe/plugin/vite` with it, unminified, with its scanner reading the cases' sources
  through an extractor for `class`, since Styleframe's JSX extractor reads only `className`.
- **The checkers read generated declarations.** `tests/integration/styleframe.d.ts` is the
  `shims.d.ts` Styleframe's transpiler writes for the configuration, without its `styleframe()`
  export. `pnpm test:update` writes it, and a harness test compares it byte for byte. Toolchains
  take it through `ToolchainContext.declarations`: Angular's ngtsc adds it to its programs, for L3
  and for its Vite path. `ToolchainContext.plugins` gives Astro's render server Styleframe's
  plugin, and the render puts Styleframe's stylesheet before the markup, as it does a scoped sheet.
- **R11 holds only for Pro.** CI never sets `STYLEFRAME_KEY`. A harness unit test builds the
  corpus's configuration for production with no key, and the same build of a configuration flagged
  as Pro fails with Styleframe's licence error.

## Consequences

**Positive:**

- Styleframe's recipes, tokens, utilities and themes render the same on all seven targets, checked
  at every live layer by the `styleframe/` and `theming/` cases.
- No licence, secret or stub reaches CI, and the visual layers see Styleframe's real stylesheet.

**Negative:**

- A styled output depends on `@styleframe/runtime` at run time, and a consumer installs Styleframe
  and its plugin.
- Styleframe's global stylesheet and a scoped sheet load in import order on five targets and in
  render order on Angular and Qwik (`sheet-order`, ADR-0063). A case whose captures depend on which
  wins declares `requires: ["sheet-order"]`. `styleframe/recipe-and-scoped` sets different
  properties in each, so it doesn't.
- Styleframe, `@styleframe/theme` and `@styleframe/runtime` are pinned exactly, since they shape
  what renders (P8).

## Alternatives considered

- **A stub of `virtual:styleframe` in CI.** It writes no CSS, so L10 would compare unstyled
  components, and it could drift from the real module's class names (§7.6).
- **A CI licence key.** Community needs none, and GitHub gives no secrets to a fork's pull
  request, so its runs could never build.
- **Folding recipe calls at compile time now.** It keeps outputs runtime-free, but needs a contract
  on Styleframe's recipe data across two repositories. It's a proposed issue, not M4.
