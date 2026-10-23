# ADR-0064: Styling engines through virtual modules, and CI without a licence

- **Status:** Proposed
- **Date:** 2026-10-23
- **Plan:** §4.4, §5.7, §7.3, §9 M4, G7, P2, P5, P7, P8, R11; C4 (ADR-0004), D11 (ADR-0015);
  amends ADR-0004 and ADR-0015; settles ADR-0004's R11 consequence; builds on ADR-0063

## Context

Plan §4.4 and ADR-0004 make Styleframe's recipes and tokens ordinary imports,
`import { button } from "virtual:styleframe"`, passed through to every target and resolved by
Styleframe's own plugin. ADR-0004 names only Styleframe. The owner's direction is wider: any
styling engine works through the virtual modules its own Vite plugin registers, and no engine
ships with Unframework. M4 also has to settle R11: "Styleframe builds require a licence", with "a
CI licence or a deterministic stub".

- An engine's module is code its plugin generates. Styleframe's recipe call returns its class
  names at run time, through `createRecipe` from `@styleframe/runtime`, so a styled output imports
  something besides its framework, which P7 and ADR-0015 rule out.
- Vite's convention for a module a plugin registers is the `virtual:` prefix. An engine that writes
  files instead (`styled-system/css`) uses its own.
- Styleframe's licence check (`validateInstanceLicense` in `@styleframe/license` 2.0.2) acts only
  on an instance a Pro feature has flagged (`__licenseRequired`). With no key, it warns in
  development, and fails only a production build of a flagged instance. Community Styleframe never
  needs a key.
- A stub that writes no CSS can't prove pixel parity (§7.6), so the visual layers need a real
  engine.

## Decision

- **The rule is the prefix, not the engine.** An import whose specifier starts with one of the
  `passThrough` prefixes passes through. The option sits on `compile()` and on the unplugin, which
  forwards it. It defaults to `["virtual:"]`, and a list replaces the default
  (`["virtual:", "styled-system/"]`). An empty, relative or absolute prefix throws, as an invalid
  option does, since such a specifier names a file of the project. The unplugin checks it once,
  when it is created. What the analyser classifies itself (the authoring API, a framework, a
  `.uf.tsx` or relative module) never passes through, whatever the prefixes.
- **Two forms pass through.** Named imports, each called in a `class` part
  (`class={button({ size })}`, alone, in an array or in a conditional), and a side-effect import
  (`import "virtual:theme.css"`, an engine's stylesheet or setup module), whatever its suffix. An
  import that matches no prefix keeps the codes it had: UF1002, or UF5003 for a preprocessor's
  suffix.
- **Anything else is UF5006,** renamed `unsupported-virtual-import`: a default, namespace or
  type-only import, a name read outside a `class` part (a toggle's condition, setup code, `?.`),
  and a name nothing reads, whose import would reach every output unused. A local name a setup
  binding can't take (`$btn`, `btn$`, `ngButton`), or a call of a name a prop of the object form
  also has, is UF2003: every output declares it beside its own names.
- **The IR keeps any such module.** `PassThroughImport.specifier` is any string that is not
  empty, relative or absolute (the schema's pattern `^(?![./\\]|[A-Za-z]:).+`), and an import binds
  nothing exactly when its `names` is empty. The IR doesn't know the option. Layer 10 of M4 widens
  the contract that layer 3 landed, beside its one consumer, since nothing else in flight reads it.
- **Every output keeps them as written, in the IR's order.** They come as one block after the
  target's sorted imports and before the component's own scoped sheet, each module once, because
  an engine's setup module, or two engines' stylesheets, depend on their order. A plugin's `ir`
  hook may drop a pass-through import, never add, duplicate, reorder or change one. Angular's
  template reads each name through a protected member, of its own name unless a member already has
  it (a prop, an output, the `class` and `style` inputs, a slot's query) or a list variable would
  shadow it, when it claims another (`style_1`).
- **The engine's plugin resolves them.** The unplugin never claims such an id, so the plugins can
  sit in either order. We list the engine's first, as Styleframe's installation guide does.
- **No engine in the compiler.** No source under `packages/*/src` names one, and no package
  depends on one. Styleframe is a devDependency of the private `tests/integration` only.
- **The runtime import is the one exception to P7.** An engine's module may import its own runtime
  (`@styleframe/runtime`). The output itself still names only its framework and its pass-through
  modules, and each target's L5 allow-list admits `virtual:*`. Compile-time folding of an engine's
  calls, which would drop the runtime, is a proposed issue.
- **Two engines prove it.** The corpus tests Styleframe, Community only, with one configuration
  (`tests/integration/styleframe.config.ts`) and its plugin unminified, its scanner reading the
  cases' sources through an extractor for `class`. A fixture engine of a few lines with no
  dependency (`harness/fixture-engine.ts`, the `engines/fixture-engine` case) proves that an
  engine nobody wrote for works the same way. Their declarations reach the checkers through
  `ToolchainContext.declarations` (Angular's ngtsc adds them to its programs) and their plugins
  reach Astro's render server through `ToolchainContext.plugins`, which puts an engine's stylesheet
  before the markup, as it does a scoped sheet.
- **R11 holds only for Pro.** CI never sets `STYLEFRAME_KEY`. A harness unit test builds the
  corpus's configuration for production with no key, and the same build of a configuration flagged
  as Pro fails with Styleframe's licence error.

## Consequences

**Positive:**

- Any engine whose plugin registers modules works on all seven targets, and an engine that writes
  files works through the option. The compiler stays engine-neutral.
- No licence, secret or stub reaches CI, and the visual layers see real stylesheets.

**Negative:**

- A styled output may depend on an engine's runtime, and a consumer installs the engine and its
  plugin.
- An engine's global stylesheet and a scoped sheet load in import order on five targets and in
  render order on Angular and Qwik (`sheet-order`, ADR-0063). A case whose captures depend on which
  wins declares `requires: ["sheet-order"]`. `styleframe/recipe-and-scoped` sets different
  properties in each, so it doesn't.
- The engines the corpus uses are pinned exactly, since they shape what renders (P8).

## Alternatives considered

- **Passing through `virtual:styleframe` alone.** It names one engine in the compiler, which the
  owner ruled out: "Unframework should support ANY styling engine".
- **A stub engine in CI.** It writes no CSS, so L10 would compare unstyled components, and it
  could drift from the real module's class names (§7.6).
- **A CI licence key.** Community needs none, and GitHub gives no secrets to a fork's pull
  request, so its runs could never build.
- **RegExp or function matchers in `passThrough`.** Prefixes cover Vite's convention and generated
  directories. A matcher can come later without changing this rule.
