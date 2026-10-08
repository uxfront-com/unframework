# Unframework compiler: plan

**Status:** proposal, 2026-10-01. **Supersedes:** the Inkline compiler (`packages/compiler-v1`, reference
only and gitignored; also at `~/Workspace/inkline/core/compiler`).

This is the plan for the next-generation Unframework compiler. One TSX component written with
Vue-inspired APIs goes in, and native React, Vue, Svelte, Solid, Angular, Qwik and Astro components
come out, each verified by executed tests. The plan covers the source language, the architecture, the
testing strategy, end-user tooling and the milestones to get there. Section 11 records the decisions
already made and lists the ones still to confirm before M0 starts.

## Contents

1. [Summary](#1-summary)
2. [What v1 taught us](#2-what-v1-taught-us)
3. [Goals, non-goals and principles](#3-goals-non-goals-and-principles)
4. [The source language](#4-the-source-language)
5. [Architecture](#5-architecture)
6. [Target mapping](#6-target-mapping)
7. [Testing strategy](#7-testing-strategy)
8. [End-user tooling](#8-end-user-tooling)
9. [Milestones](#9-milestones)
10. [Risks](#10-risks)
11. [Decisions](#11-decisions)
12. [Appendix A: golden output sketches](#appendix-a-golden-output-sketches)
13. [Appendix B: v1 concept map](#appendix-b-v1-concept-map)
14. [Appendix C: version baseline](#appendix-c-version-baseline)

---

## 1. Summary

- **Source:** `Button.uf.tsx`. A component is a plain exported function written in JSX with
  Vue-inspired APIs.
  - **Props:** declared in the function signature.
  - **Body:** the setup, which runs once.
  - **APIs:** `ref`, `computed`, `watch` and the `defineEmits` / `defineModel` / `defineSlots` /
    `defineExpose` macros, all imported from `unframework` and erased at build time.
  - **JSX:** the returned JSX is the template. Control flow is plain JS (ternaries, `&&`, `.map`), and
    `v-model` is the one directive.
  - **Styles:** a sibling CSS file that the component imports and the compiler scopes.

  It is ordinary TSX, so tsgo type-checks it, any TypeScript editor understands it, and models write it
  fluently.

- **Compiler:** a chain of small passes over plain-data IR.
  - Parsing is oxc only. Nothing in the compiler imports TypeScript's API.
  - Type information goes through one `TypeOracle` interface: a syntactic resolver by default, and a
    tsgo adapter that moves to the TS 7.1 API when it ships.
  - Consumers get typed events, models and slots through layered tooling (§5.6), ending in a TS 7.1
    content mapper.
- **Targets:**
  - one package per framework, versioned (`solid@1`, `solid@2`), each with a declared capability matrix
  - third-party targets use the same interface
  - the integration corpus doubles as the conformance kit for any target, which makes the "eighth
    framework" story testable
- **Testing first:** the unit of work is an integration case. Each case has one `.uf.tsx` input, all
  seven outputs, and one spec that runs once per target in a real browser. It checks:
  - golden output, framework compile, types and lint
  - SSR HTML parity, DOM and accessibility-tree parity
  - scripted interactions and visual parity
  - axe, hydration and console hygiene

  Cross-target parity comes from shared expected artefacts: one expectation, verified seven times.

- **Tooling:**
  - an unplugin plugin for every bundler, and a CLI
  - `@unframework/testing`, the same harness the corpus uses
  - `@unframework/visual`, for cross-framework visual parity and a seven-up preview
  - a TS 7.1 content mapper for full consumer typing in editors
  - later, a component manifest and an MCP server
- **Milestones:**
  - M0 builds the whole verification machine around a trivial component, before any real feature
    exists.
  - M1–M5 grow the language.
  - M6–M9 grow the tooling.
  - M10 is design-system acceptance and 1.0.

---

## 2. What v1 taught us

From the v1 source, its ADRs and the Inkline monorepo (`~/Workspace/inkline`):

- **It cannot move to TypeScript 7.**
  - `ts.Expression`, `ts.TypeNode`, `ts.Statement` and `ts.Symbol` sit inside the IR.
  - 34 source files import `typescript` at runtime, and codegen calls `getText()` 28 times.
  - TypeScript 7.0 ships no in-process JS API.
- **Rewriting was by string concatenation and by name.**
  - The expression rewriter matched identifiers by name, not scope, and glued strings together.
  - It silently copied unhandled syntax through: `await`, `new`, `{ count }` shorthand, template-literal
    escapes.
  - Declarations were sorted into buckets, which lost source order. That caused TDZ bugs (INK-12) and
    forced non-function setup locals to be rejected (INK0121).
- **The tests were mostly hollow.**
  - The scenario file's DOM and click assertions never ran; only `expectedDiagnostics` was consumed.
  - `mount` could not load `.tsx`, `.vue` or `.svelte` files.
  - Equivalence passed if any two targets matched.
  - Typecheck covered only React and Solid, with about 125 quarantined fixtures.
  - SFC outputs were never linted.
  - No framework compiler (ngc, the Qwik optimizer, svelte, compiler-sfc) ever ran on the output.
  - The real behavioural checks were one Qwik test, plus Storybook screenshots compared against React.
    Only one of the 53 stories had interaction steps.
- **Behaviour tests would have caught real bugs immediately:**
  - Qwik effects without `track` never re-ran.
  - Qwik handlers missing `$` never fired (INK-31).
  - Qwik loops dropped their keys.
  - Angular dropped `if` and `const` statements inside handlers.
  - `untrack` was emitted but never imported.
- **The build plugin was effectively unused.**
  - It returned Vue and Svelte SFC source under an `.ink.tsx` id, so their Vite plugins never
    processed it.
  - Qwik, Angular and Astro were never auto-detected.
  - Nothing in the repo used it.
- **Macros in a TSX body cannot type a component for its consumers.** TypeScript infers only from a
  call's arguments, never from a function body (ADR-008). v1 spent two ADRs, a correction and a
  reverted channel on this, and still shipped `[attr: string]: any`. The macros chosen here (§11, C3)
  inherit the problem, so §5.6 solves it on purpose, in layers, rather than by accident.
- **Worth keeping:**
  - A pipeline of pure passes.
  - A discriminated render IR and a complete declarations catalogue.
  - The macro discipline: recognised by binding, called at the top level, statically analysable, erased.
  - JSX types vendored from an upstream behind an owned alias, with probe tests that pin what they catch
    (ADR-003).
  - A diagnostics catalogue with stable codes and honest per-target warnings.
  - Per-target reactivity "dialects".
  - The headless/styled split.
  - "A gate that cannot start is a failure" (ADR-009).
  - "The quarantine list can only shrink."

---

## 3. Goals, non-goals and principles

### Goals

| ID  | Goal                   | Means                                                                                                                                                      |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Proven parity          | Every feature on every target is verified by executed tests: structural, typed, rendered, interactive, visual and accessible.                              |
| G2  | Idiomatic output       | Output reads as a senior developer of that framework would write it, and passes that framework's compiler, type-checker and lint rules with zero warnings. |
| G3  | Future-proof           | Targets are versioned, pluggable packages. A new framework or major version is an addition, and the corpus is its conformance kit.                         |
| G4  | Built for agents       | A syntax models already know, deterministic output, stable diagnostic codes with machine-applicable fixes, a machine-readable component manifest, MCP.     |
| G5  | Ready for TypeScript 7 | No compiler package uses TypeScript's API. Type information crosses one seam.                                                                              |
| G6  | Reusable packages      | Small packages with one job each (parser, IR, target kit, testing), usable on their own.                                                                   |
| G7  | Design-system grade    | Open Components conformance, Styleframe integration, accessibility.                                                                                        |

### Non-goals for 1.0

- A component runtime. Outputs depend only on their framework (P7).
- React's or Solid's APIs in the source. There are no hooks and no `createSignal`. The APIs are
  Vue-inspired, and React is a target, not the authoring model.
- All of Vue: no Options API, deep `reactive()` proxies, render functions returned from setup,
  `<KeepAlive>`, `<Suspense>`, `getCurrentInstance` or `$parent`.
- App concerns: routing, stores, data-fetching frameworks.
- A web-components target. It is a natural eighth target later, not a 1.0 one.

### Principles

- **P1. Tests before features.** M0 builds the verification machine around a component with no
  features. A feature is done when its corpus cases are green on every target, not when it emits code.
- **P2. Loud, never silent.**
  - Every construct the compiler cannot lower is a diagnostic. Nothing is copied through unanalysed.
  - A gate that cannot start fails.
  - A skip always carries a reason.
- **P3. One way to write each thing.** Each concept has one canonical form. Alternatives get a
  diagnostic with a fix. v1 had three channels for props alone.
- **P4. Semantics are written down.** A semantics contract (§4.5) states what every target guarantees.
  Deviations are declared in the capability matrix, never discovered.
- **P5. Plain data between stages.** The IR is JSON: versioned, schema-validated and snapshotted.
- **P6. Targets own their idioms.** Shared layers stay target-agnostic. v1's Angular "collapse" logic
  leaked into shared code.
- **P7. No runtime by default.** Where a framework lacks a primitive, the helper is emitted inline,
  kept small, and listed in the capability matrix.
- **P8. Deterministic.** The same input and the same versions give byte-identical output.

---

## 4. The source language

### 4.1 File format

```tsx
// Counter.uf.tsx
import { computed, defineEmits, ref } from "unframework";
import "./Counter.css";

export interface CounterProps {
  initial?: number;
  step?: number;
}

export default function Counter({ initial = 0, step = 1 }: CounterProps) {
  const emit = defineEmits<{ change: [value: number] }>();

  const count = ref(initial);
  const doubled = computed(() => count.value * 2);

  function increment() {
    count.value += step;
    emit("change", count.value);
  }

  return (
    <div class="counter">
      <output>{count.value}</output>
      {doubled.value > 10 ? <span>Big</span> : null}
      <button type="button" onClick={increment}>
        +{step}
      </button>
    </div>
  );
}
```

```css
/* Counter.css, scoped to Counter by the compiler */
.counter {
  display: flex;
  gap: 0.5rem;
}
```

- **Files (D1).**
  - Components live in `*.uf.tsx`.
  - Composables, logic shared between components, live in `*.uf.ts` and are compiled per target
    (M5).
  - Plain `*.ts` modules are framework-agnostic and are copied into each output tree unchanged.

  The `.uf` infix is what the bundler plugin and the content mapper (§5.6) key on, and it tells
  Unframework components apart from a host app's own `.tsx`.

- **A component** is an exported PascalCase function whose last statement returns JSX.
  - Its body is the setup, and it runs once per instance (§4.5).
  - Each exported component compiles to its own file for every target.
  - A non-exported component is local to its file, and still becomes a sibling file in each output.
- **The authoring API (D2)** comes from `unframework`: types, plus inert stubs that the compiler
  recognises by binding (not by name) and erases. No `unframework` import survives into any output.
- **JSX types.** `tsconfig` sets `"jsx": "preserve"` and `"jsxImportSource": "unframework"`. The
  `unframework/jsx-runtime` types follow ADR-003: intrinsic elements are vendored from Vue's
  `@vue/runtime-dom` JSX types (HTML attribute names, Vue event names), behind an owned alias, with
  probe tests that pin what they catch (D13).

### 4.2 Setup: the component body

| Concept       | Canonical form                                                                                    | Notes                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Props         | `function Button({ size = "md", disabled = false }: ButtonProps)`                                 | The first parameter, with a type annotation. Destructured props stay reactive, as with Vue 3.5. `(props: ButtonProps)` is accepted when nothing has a default. |
| Events        | `const emit = defineEmits<{ change: [value: string] }>()`                                         | Consumers write `onChange={…}`. Named-tuple payloads carry their types to every target.                                                                        |
| Models        | `const open = defineModel<boolean>("open", { default: false })`                                   | A name is required. Consumers write `v-model:open={x.value}`. A model is controllable on every target: it works bound or unbound.                              |
| Slots         | `const slots = defineSlots<{ default?(): JSX.Element; item?(p: { item: Item }): JSX.Element }>()` | Rendered with `{slots.item?.({ item })}`. Presence is `slots.item`.                                                                                            |
| Expose        | `defineExpose({ focus })`                                                                         | The component-ref API on each target.                                                                                                                          |
| Options       | `defineOptions({ inheritAttrs: false })`                                                          | A static object literal.                                                                                                                                       |
| State         | `const count = ref(0)`                                                                            | Writes: `x.value = …`, `x.value++`, `x.value += …`. Objects and arrays are replaced whole (D4).                                                                |
| Derived       | `const total = computed(() => …)`                                                                 | Read-only.                                                                                                                                                     |
| Effects       | `watch(source, (value, previous, onCleanup) => …, { immediate })`, `watchEffect(…)`               | Client-only (§4.5).                                                                                                                                            |
| Lifecycle     | `onMounted(…)`, `onUnmounted(…)`                                                                  | Client-only.                                                                                                                                                   |
| Template refs | `const input = useTemplateRef<HTMLInputElement>()` with `<input ref={input} />`                   | JSX passes the ref object, so there is no string key. This is the one deliberate departure from Vue's signature.                                               |
| Context       | `provide(TabsKey, value)`, `inject(TabsKey, fallback)`                                            | `export const TabsKey: InjectionKey<Tabs> = Symbol("Tabs")` in a `.ts` module. Reactive values pass as refs or computeds.                                      |
| IDs           | `const id = useId()`                                                                              | Stable under SSR on every target.                                                                                                                              |
| Locals        | functions, constants, imports of `.ts` / `.uf.ts` modules                                         | Kept in source order. Every identifier is resolved by scope.                                                                                                   |

**Rules:**

- Macros and reactive APIs are called at the top level of the component body: never inside a
  condition, a loop or a nested function. Setup runs once, and React's output turns them into hooks.
- Macro results are bound, except for `defineExpose` and `defineOptions`.
- Type arguments and option objects are static.
- Each concern has one channel.

### 4.3 The returned JSX

The JSX a component returns is its template.

- **Elements** use HTML attribute names: `class`, `for`, `tabindex`, `aria-*`, `data-*`. Events use
  Vue's JSX names: `onClick`, `onInput`, `onKeydown`.
  - `class` takes a string, array or object.
  - `style` takes an object or a string.
  - `{...object}` spreads attributes.
- **Event options** are Vue's suffixes: `onClickCapture`, `onClickOnce`, `onClickPassive`. Everything
  else is plain JS inside the handler, such as `event.preventDefault()` and `if (event.key === "Enter")`.
- **Conditionals:**
  - `cond ? <A /> : <B />`
  - `cond ? <A /> : null`
  - `cond && <A />`
  - nested ternaries, which are else-if chains

  The compiler lowers each of these to `v-if`, `@if`, `{#if}` and so on.

- **Lists:** `items.value.map((item, index) => <li key={item.id}>…</li>)` over any array expression,
  with `key` on the callback's root. The compiler lowers it to `v-for`, `@for`, `{#each}` and so on.
- **Two-way binding:** `v-model={text.value}` is the only directive.
  - It works on `input`, `textarea` and `select`, on boolean and array checkboxes, and on radios.
  - Modifiers use Vue JSX's form: `v-model_trim`, `v-model_lazy`, `v-model_number`.
  - On components it is `v-model:open={x.value}`.
  - The value must be assignable: `ref.value` or `model.value`.
- **Slots, consumer side:**
  - The default slot is the JSX children.
  - Named and scoped slots are a slot object as children:
    `{{ default: () => …, title: () => …, item: ({ item }) => … }}`.
- **Slots, component side:**
  - render with `{slots.title?.()}` or `{slots.item?.({ item })}`
  - give fallback content with `{slots.default?.() ?? label}`
  - test presence with `slots.title ? … : …`
- **Composition:**
  - PascalCase components imported from `.uf.tsx` files
  - `ref={input}`
  - `<>…</>` fragments
  - `<component is={href ? "a" : "button"}>` over a statically known set of tags or components
- **Whitespace** follows JSX rules, which are the source of truth. The compiler emits explicit text
  for every template target.
- **Later (M8):** `<Transition>` and `<Teleport>` (imported from `unframework`), `innerHTML` (with a
  warning), and portable directives.

### 4.4 Styles

- **Scoping (C4, D5).** A relative `.css` import in a component (`import "./Button.css"`) is that
  component's scoped stylesheet.
  - The compiler scopes it once with Vue's algorithm: a deterministic per-component attribute, with
    child-root, `:deep()`, `:slotted()` and `:global()` semantics.
  - It then attaches the result each target's native way.
  - Each framework's own scoping differs, and Svelte drops selectors it cannot match statically, which
    would break recipe-driven classes. That is why the compiler does the scoping, not the framework.
- **One owner per stylesheet.** A stylesheet imported by two components is a diagnostic.
- **Engine.** lightningcss parses and rewrites the selectors.
- **Dynamic values** are custom properties set from JSX (`style={{ "--gap": gap }}`).
- **Styleframe.** Recipes and tokens are ordinary imports (`import { button } from "virtual:styleframe"`)
  passed through to every target. Styleframe's own plugin resolves them.

### 4.5 Semantics contract

Vue's semantics are the reference wherever every target can meet them. Where a target cannot, the
contract states the portable guarantee, and the capability matrix declares the deviation. Each rule has
at least one corpus case named `semantics/<rule>`.

| Rule                    | Guarantee                                                                                                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup runs once         | The body runs once per instance on every target. A plain `const` is evaluated once. React re-runs the function on every render, so its output keeps snapshots stable. The compiler warns when such a `const` reads a reactive value and offers `computed` as the fix. |
| Reactive props          | A destructured prop read in JSX, `computed` or `watch` tracks the prop. Read directly in setup (`ref(initial)`), it captures the value the parent passed. On Angular that means after inputs are set, not in a field initialiser.                                     |
| Read after write        | A ref read after a write in the same function sees the new value. React keeps this with local shadows, and with mirror refs when the read escapes into async code (§6).                                                                                               |
| Derived consistency     | A computed is consistent whenever it is read, including right after a write.                                                                                                                                                                                          |
| Watch timing            | A watcher runs after the writes that triggered it, at most once per batch, in declaration order, with the correct previous value. DOM reads need `flush: "post"`.                                                                                                     |
| Effects are client-only | Watchers and lifecycle hooks never run during SSR. SSR renders the initial state.                                                                                                                                                                                     |
| Emit                    | `emit` returns `void`. Code must not depend on listener completion, because Qwik's QRL listeners are asynchronous.                                                                                                                                                    |
| Keyed lists             | Reordering a keyed list keeps DOM identity, so focus and input state survive.                                                                                                                                                                                         |
| Models                  | A model is controllable: it works bound (`v-model`) and unbound (local state seeded by `default`).                                                                                                                                                                    |
| Determinism             | Rendering is a pure function of props, state and slots. `Math.random` and `Date` in render are diagnostics, as Open Components requires.                                                                                                                              |

### 4.6 Rejected constructs

Each of these is a diagnostic, with a fix wherever a mechanical rewrite exists.

| Construct                                                                                                          | Fix offered                                                     |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `list.value.push(x)`, `form.value.name = x`                                                                        | `list.value = [...list.value, x]`, `{ ...form.value, name: x }` |
| JSX outside the returned tree and slot functions: in a variable, returned from a helper, passed as a non-slot prop | Inline it, move it into a slot function, or extract a component |
| An early or conditional `return`                                                                                   | Move the condition into the JSX                                 |
| A macro or reactive API inside a condition, loop or nested function                                                | Hoist it to the top level                                       |
| `className`, `htmlFor`, `onKeyDown`                                                                                | `class`, `for`, `onKeydown`                                     |
| An import from `react`, `vue`, `solid-js` or another framework                                                     | none; the source is framework-free                              |
| `reactive()`, `toRefs()`, a setup that returns a render function                                                   | none (outside the subset)                                       |
| `defineModel()` without a name                                                                                     | `defineModel("value")`                                          |
| `<component is>` over an open set                                                                                  | none; declare the union of tags or components                   |
| A feature unsupported on a selected target                                                                         | per capability (warning, or error in `strict`)                  |

As built in M0: JSX returned from a local helper is UF3012 `jsx-outside-template`, with no fix;
JSX in a variable or a non-slot prop is reported as unsupported setup code (UF1002) until M1
analyses setup code.

---

## 5. Architecture

### 5.1 Pipeline

```
 Button.uf.tsx  (+ Button.css)
     │  P1 parse     oxc-parser (TSX, TS-ESTree) for the whole file; component discovery;
     ▼               the stylesheet through lightningcss. No TypeScript dependency.
 Source AST
     │  P2 analyse   scopes and bindings · macros · reactivity graph · type queries
     ▼               (TypeOracle) · cross-component API checks · semantic diagnostics
 Component model
     │  P3 lower     JSX → portable render IR: ternaries, && and .map → If/For,
     ▼               slot calls and slot objects, v-model, class/style, fallthrough, CSS scoping
 Portable IR (JSON, versioned, schema-validated)        ◀── plugin hook: ir
     │  P4 check     the selected targets' capability matrices → portability diagnostics
     ▼
     │  P5 emit      one target package per framework → output AST + preserved user code
     ▼
     │  P6 print     print · format (oxfmt) · compose source maps
     ▼
 Button.tsx · Button.vue · Button.svelte · button.ts · Button.astro …   ◀── plugin hook: output
```

**How the passes behave:**

- Passes are pure, and diagnostics never throw.
- An error in one component never stops its siblings.
- The project layer (§5.9) owns the module graph and caching.
- `compile()` is a pure function of a source, its resolved dependencies and the options.

### 5.2 Packages

Each package follows the `@uxfront/scene` model:

- In the workspace, `exports` point at `src`; `publishConfig.exports` point at `dist`.
- It is built with tsdown, using `unbundle`.
- `isolatedDeclarations` is on.
- Tests run under Vitest 5.

| Package                         | Role                                                                                                                                                                      | Depends on                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `@unframework/parser`           | Parses `.uf.tsx` / `.uf.ts` into a TS-ESTree AST with spans, finds the components, parses stylesheets.                                                                    | `oxc-parser`, `lightningcss`                        |
| `@unframework/ir`               | IR types, builders, visitors, JSON schema, versioning and migrations. Pure data.                                                                                          | none                                                |
| `@unframework/diagnostics`      | The diagnostic type, the catalogue, code frames, JSON/SARIF output, fixes.                                                                                                | none                                                |
| `@unframework/type-oracle`      | The `TypeOracle` interface, the syntactic resolver, and the adapter contract test suite.                                                                                  | `oxc-parser`, `oxc-resolver`                        |
| `@unframework/type-oracle-tsgo` | The tsgo adapter: `typescript/unstable/sync` now, the TS 7.1 API later. The only package that imports `typescript`.                                                       | `typescript` (exact pin)                            |
| `@unframework/analyzer`         | P2 and P3: bindings, macros, reactivity, cross-component checks, lowering into IR.                                                                                        | `parser`, `ir`, `type-oracle`, `diagnostics`        |
| `@unframework/codegen`          | The target kit: JS, JSX and markup builders, the rewrite engine, CSS scoper, import manager, source maps, `defineTarget`.                                                 | `ir`, `magic-string`, `oxc-codegen`, `lightningcss` |
| `@unframework/target-<name>` ×7 | One framework each: `emit()`, capabilities, options, and a `/toolchain` entry for tests.                                                                                  | `ir`, `codegen`                                     |
| `@unframework/compiler`         | The project graph, `compile()`, caching, plugins and config resolution.                                                                                                   | `analyzer`, the targets                             |
| `unframework`                   | The authoring API and `unframework/jsx-runtime` types (root export, types and stubs only), `defineConfig`, the `unframework` bin, and tooling re-exported under subpaths. | lazy-loaded tooling                                 |
| `@unframework/unplugin`         | The bundler plugin (`/vite`, `/rolldown`, `/rollup`, `/webpack`, `/rspack`, `/esbuild`, `/bun`, …).                                                                       | `compiler`, `unplugin`                              |
| `@unframework/cli`              | `build`, `check`, `test`, `preview`, `visual`, `manifest`, `explain`, `fix` and `init`.                                                                                   | `compiler`                                          |
| `@unframework/language-tools`   | The TS 7.1 content mapper for `.uf.tsx`: consumer typing and UF diagnostics in editors and tsgo (M5).                                                                     | `compiler`                                          |
| `@unframework/testing`          | The cross-target test API, mount adapters, matchers and a Vitest preset. Private until M7.                                                                                | `vitest`, the targets' toolchains                   |
| `@unframework/visual`           | The visual parity runner, its report, and the seven-up preview server.                                                                                                    | `testing`                                           |
| `@unframework/mcp`              | The MCP server for agents (M9).                                                                                                                                           | `compiler`, `testing`                               |
| `create-unframework`            | The project scaffolder (M6).                                                                                                                                              | none                                                |

**Layering rules.** A dependency-cruiser-style test enforces these:

- A package never imports one above it.
- Targets depend only on `ir` and `codegen`.
- Only `type-oracle-tsgo` and the test toolchains import `typescript`.

```
packages/   parser ir diagnostics type-oracle type-oracle-tsgo analyzer codegen target-* compiler
            unframework unplugin cli language-tools testing visual mcp create-unframework
tests/      integration/   the corpus and harness (private)
            toolchains/    one per target: tsconfig, lint config, TS 6 alias where still needed
            e2e/           one real app per framework consuming a sample design system (M6)
apps/web    unframework.dev
```

### 5.3 IR

The IR is plain JSON, versioned by `irVersion`, with a JSON Schema generated from its types. Every IR
snapshot in the corpus is validated against that schema.

- **`UfModule`**: `{ irVersion, file, components: UfComponent[], exports }`.
- **`UfComponent`**:
  - `name`, `props[]`, `emits[]`, `models[]`, `slots[]`, `exposes[]`, `options`
  - `bindings: Binding[]`
  - `setup: SetupItem[]`
  - `render: Node`
  - `styles: StyleSheet[]`
  - `imports`
- **`Binding`**: `{ id, name, kind, span, type? }`.
  - `kind` is one of `prop`, `model`, `state`, `derived`, `templateRef`, `slots`, `context`,
    `localConst`, `localFn`, `import`, `loopVar` or `slotScope`.
  - The `id` is stable: `name@offset`.
- **`SetupItem`**: `State`, `Derived`, `Watch`, `Lifecycle`, `Provide`, `Function`, `Const` or
  `Statement`, in source order. Order is never lost, which fixes INK-12.
- **Render nodes:** `Element`, `Component`, `Text`, `Interpolation`, `If`, `For`, `SlotOutlet`,
  `SlotFill`, `Fragment`, `Dynamic`, and later `Transition` and `Teleport`.
- **Attribute kinds:** `Static`, `Bound`, `Spread`, `Class`, `Style`, `Model` (with the native input
  kind), `Event` (with normalised options) and `Ref`.
- **Rules:**
  - Every node carries a span.
  - A field is added only when a consumer reads it. v1 carried eight unread fields.
  - Migrations start after the first publish.

### 5.4 Expressions and rewriting

The compiler analyses expressions as ASTs and rewrites them as text.

```ts
interface Expr {
  code: string; // the original source slice
  span: Span;
  refs: Reference[]; // every identifier resolved to a binding, by scope
}
interface Reference {
  start: number;
  end: number;
  binding: BindingId;
  access: "read" | "write" | "update" | "call";
}
```

- **Analysis.** P2 resolves every identifier through a real scope analysis, so shadowing is respected.
  - It records references, not AST objects. That keeps the IR serialisable and free of TypeScript.
  - Syntax it cannot classify is a diagnostic, never a silent copy.
- **Rewriting.** Each target's emitter rewrites code slices by splicing at reference spans with
  magic-string.
  - Every binding kind and context (render, handler, setup) has its own rule. For example, `count.value`
    becomes `count` in React's JSX, `count()` in Solid, `this.count()` in an Angular class, and `count`
    in a Vue template.
  - Splicing keeps the author's formatting and comments, and gives sub-expression source maps for free.
  - Structural rewrites are span edits computed from `write` and `update` references. One example is
    React's `count.value++` becoming a setter call.
- **New code.** Code the compiler synthesises (imports, wrappers, helpers) is built as AST and printed
  with oxc-codegen.
- **Control flow.** The JSX tree is lowered from expression shape.
  - A conditional or logical expression whose branches yield JSX becomes an `If`.
  - A `.map` call whose callback returns JSX becomes a `For`.
  - Every other expression stays an `Interpolation`.

### 5.5 Type information and the TypeScript 7 seam

**Where TypeScript stands in October 2026:**

- TypeScript 7.0 (Jul 8, 2026) ships the Go compiler and no stable API.
- `typescript@7.0.2` does include an unstable IPC API (`typescript/unstable/sync` and `/async`). A
  local probe used it to resolve an imported `extends` chain for props.
- TS 7.1, planned stable on Nov 24, 2026, is meant to stabilise that API and add content mappers.
  Content mappers are TypeScript 7's replacement for Volar and tsserver plugins.
- The Vue, Svelte, Astro and Angular checkers still need TypeScript 6 until then.

**Why TSX helps.** The source is TSX, so tsgo type-checks it directly:

- component bodies
- macro return values (`emit`, `open`, `slots`)
- consumer props

The only part tsgo cannot see is the public API that the macros declare, which §5.6 covers.

**The seam:**

```ts
export interface TypeOracle {
  /** Resolves the shape of a type at a location: props, emits, slot props, model types. */
  resolveShape(query: ShapeQuery): Promise<TypeShape>;
  /** Prints a type in a form every target's type system accepts. */
  printType(query: TypeQuery): Promise<string>;
  /** Tells the oracle which files changed, for incremental builds. */
  update(changes: FileChanges): Promise<void>;
  dispose(): Promise<void>;
}
```

The interface is coarse-grained, asynchronous and returns serialisable results, which is what an
IPC-backed checker needs.

**Two adapters:**

1. **`syntactic` (the default).** Built on oxc and oxc-resolver, with no checker process. It handles:
   - type literals
   - local and imported interfaces with `extends`
   - type aliases, unions, intersections and literal unions
   - the utility types `Partial`, `Required`, `Pick`, `Omit` and `Readonly`
   - package types, through `types` and `exports`

   That covers almost every design-system props type.

2. **`tsgo` (opt-in).** Built on `typescript/unstable/sync`, pinned to an exact version and isolated in
   its own package. It handles anything the syntactic resolver reports as unresolvable, such as
   conditional types and complex generics.

**The migration path.** Both adapters run the same contract suite (`type-oracle/contract`). Moving to
the TS 7.1 API means making that suite green on the new adapter, then flipping the default if it is
better. No other package changes.

**The repo's own toolchain:**

- TypeScript 7.0.2 (tsgo) for `check-types`.
- tsdown with oxc isolated declarations for `.d.ts` files.
- `isolatedDeclarations`, `erasableSyntaxOnly` and `verbatimModuleSyntax` are on.
- Scripts run directly under Node 24's type stripping.

**Checking the outputs:**

- tsgo type-checks the TSX outputs (React, Solid, Qwik).
- vue-tsc, svelte-check, `astro check` and `@angular/compiler-cli` (peer `>=6.0 <6.1`) still need
  TypeScript 6 (`@typescript/typescript6`). That dependency stays confined to `tests/toolchains/*`.
- Each checker moves to TypeScript 7 as its ecosystem does: Vue's content mapper, Angular's ngp.

### 5.6 Typing components for their consumers

Props are in the signature, so tsgo checks them for every consumer. Events, models and slots are
declared by macros in the body, and TypeScript cannot see a body (ADR-008). Four layers close that gap.
Each one is useful on its own.

1. **Stock tsgo: no false errors.**
   - `unframework`'s JSX `IntrinsicAttributes` accepts `on${Capitalize<string>}` handlers,
     `v-model` / `v-model:${string}` and slot-object children on every component.
   - Legitimate code never fails to type-check, but payloads are not checked.
   - This replaces v1's blanket `[attr: string]: any` with targeted index signatures, and probe tests
     pin exactly what they catch.
2. **The compiler: always on.** The project graph knows every component's API. The compiler reports
   UF3xxx diagnostics with "did you mean" for:
   - unknown or misspelt events, models and slots
   - a slot object key the child never declares
   - a literal value outside a literal union

   These surface in `check`, the CLI and editors.

3. **The content mapper (M5).** `@unframework/language-tools` is a TS 7.1 content mapper for `.uf.tsx`.
   - It serves virtual TSX that adds each component's macro-declared events, models and slots to its
     exported signature, plus span maps and the compiler's diagnostics.
   - With it, tsgo and editors type-check consumers completely: payloads, model types and slot props.
   - It needs TypeScript's `--runExternalCode`, and VS Code runs it only in trusted workspaces.
4. **The outputs.** Every target's output is type-checked (L4), including consumer type tests. A
   misused event, model or slot must fail type-checking on every typed target, mapped back to the
   `.uf.tsx` line.

Whether a content mapper may claim `.uf.tsx`, a suffix of a native extension, is open. M0's spike 6
settles it. The fallback is a distinct extension (`.uf`) associated with the TSX grammar.

### 5.7 Targets

```ts
export interface Target {
  readonly name: string; // "react": an open string, and third-party targets are welcome
  readonly framework: { package: string; range: string }; // "react", ">=19.2 <20"
  readonly capabilities: Capabilities; // feature → native | emulated(helper) | unsupported(diagnostic)
  readonly options?: StandardSchemaV1; // validated target options
  emit(component: UfComponent, context: EmitContext): OutputFile[];
}
// `@unframework/target-react/toolchain` (tests and tooling only): Vite plugins, SSR renderer,
// mount adapter, typecheck and lint commands, settle hooks.
```

- **Targets are versioned.** A framework's new major is a target variant, such as `solid@1` →
  `solid@2`, or Vue 3.5 → 3.6 Vapor as an option. Users can ship both from one source while they move.
- **Capabilities drive the diagnostics.** With Angular selected, using slot presence reports how it is
  emulated there. On Astro, which is static, an `onClick` reports that it is inert.
- **The corpus is the conformance kit.** `unframework test --target ./my-target` runs the whole corpus
  against any target package. That is how the next framework gets added and trusted.

### 5.8 Code generation, formatting and source maps

- **`@unframework/codegen` provides:**
  - builders for JS and TS (oxc-codegen), JSX, and markup (Vue, Svelte, Angular and Astro templates),
    with the escaping each syntax needs
  - the rewrite engine (§5.4)
  - an import manager and collision-free naming
  - the CSS scoper
  - a V3 source-map composer with `sourcesContent` and `names`
- **Formatting.** Code is formatted with `oxfmt.format()` at a pinned version, so golden files are
  formatted code.
  - Markup (Vue, Svelte and Astro templates, and Angular's inline template) keeps the printer's
    whitespace-safe layout: oxfmt's CSS whitespace model changes the DOM a template compiler builds
    (ADR-0026).
  - The dev server skips formatting.
- **Source maps.** Maps chain `.uf.tsx` → target source, and the framework compiler and bundler
  continue the chain. M6 checks that a runtime error's stack trace points at the right `.uf.tsx` line.

### 5.9 Diagnostics

```ts
interface Diagnostic {
  code: `UF${number}`; // stable, catalogued, documented at unframework.dev/diagnostics/UF2103
  severity: "error" | "warning" | "info";
  message: string;
  span: Span;
  related?: { span: Span; message: string }[];
  help?: string;
  fixes?: { title: string; edits: TextEdit[]; confidence: "safe" | "likely" }[];
  target?: string; // set for portability diagnostics
}
```

| Band   | Covers                        |
| ------ | ----------------------------- |
| UF1xxx | Syntax and components         |
| UF2xxx | Setup and macros              |
| UF3xxx | JSX and cross-component usage |
| UF4xxx | Portability (capabilities)    |
| UF5xxx | Styles                        |
| UF6xxx | Types                         |
| UF7xxx | Config and tooling            |
| UF8xxx | Plugins                       |
| UF9xxx | Internal                      |

- **Rendering:** a pretty code frame for people, plus JSON and SARIF for agents and CI.
- **Gates:**
  - Every catalogued code has at least one corpus case that triggers it. v1 had 8 codes that never
    fired.
  - Every fix is applied and re-compiled in a test.

### 5.10 Project graph, caching and plugins

- **The project graph.** `createProject({ root, targets, typeOracle })` holds the module graph:
  components, composables, shared modules, stylesheets and type dependencies. The cross-component
  checks in §5.6 read from it.
- **Incremental builds.**
  - Every file is hashed by its content, and a change invalidates its dependents along the graph's
    edges. v1 hashed each file on its own and invalidated nothing else.
  - IR is cached as JSON for the CLI and CI.
- **Compiler plugins.** There are two hooks: `ir`, which may transform the IR, and `output`, which may
  transform files. A plugin that throws becomes a diagnostic.

---

## 6. Target mapping

This is the starting mapping. Corpus cases confirm or change every cell. A cell marked "emulated" names
its helper in the capability matrix.

| Source                       | React 19                              | Vue 3.5                   | Svelte 5                    | Solid 1.9                | Angular 22                                   | Qwik 2                   | Astro 7 (static)        |
| ---------------------------- | ------------------------------------- | ------------------------- | --------------------------- | ------------------------ | -------------------------------------------- | ------------------------ | ----------------------- |
| File                         | `Button.tsx`                          | `Button.vue`              | `Button.svelte`             | `Button.tsx`             | `button.ts`                                  | `Button.tsx`             | `Button.astro`          |
| Signature props              | destructured params                   | `defineProps` destructure | `$props()` destructure      | `mergeProps` + `props.x` | `input(default)`                             | destructured props       | `Astro.props`           |
| `defineEmits` `change`       | `onChange` prop                       | `defineEmits`             | `onchange` prop (D8)        | `onChange` prop          | `output()`                                   | `onChange$` QRL prop     | inert (UF4)             |
| `defineModel("open")`        | `open` / `onOpenChange`, controllable | `defineModel`             | `$bindable`                 | `open` / `onOpenChange`  | `model()`                                    | `open` / `onOpenChange$` | prop only               |
| `ref`                        | `useState` (+ a mirror if needed)     | `ref`                     | `$state`                    | `createSignal`           | `signal`                                     | `useSignal`              | `const`                 |
| `computed`                   | `useMemo`                             | `computed`                | `$derived`                  | `createMemo`             | `computed`                                   | `useComputed$`           | `const`                 |
| `watch`                      | `useEffect` + previous ref            | `watch`                   | `$effect` + previous        | `createEffect(on(…))`    | `effect` + previous                          | `useTask$` + `track`     | not run                 |
| `onMounted`                  | `useEffect(…, [])`                    | `onMounted`               | `onMount`                   | `onMount`                | `afterNextRender`                            | `useVisibleTask$`        | not run                 |
| `useTemplateRef` + `ref={x}` | `useRef`                              | `useTemplateRef`          | `bind:this`                 | `ref={el}`               | `viewChild()`                                | `useSignal<Element>`     | n/a                     |
| `defineExpose`               | `ref` prop + `useImperativeHandle`    | `defineExpose`            | exported functions          | `ref` callback           | public methods                               | emulated (UF4)           | n/a                     |
| `provide` / `inject`         | `createContext` + `use`               | `provide` / `inject`      | `setContext` / `getContext` | `createContext`          | `InjectionToken` + `inject`                  | `createContextId`        | fallback only           |
| `slots.default?.()`          | `children`                            | `<slot>`                  | `{@render children?.()}`    | `props.children`         | `<ng-content>`                               | `<Slot />`               | `<slot />`              |
| `slots.item?.({ item })`     | render prop                           | scoped slot               | snippet with arguments      | function prop            | `ng-template` + outlet                       | emulated                 | `Astro.slots.render`    |
| `slots.title` (presence)     | `!= null`                             | `$slots.title`            | `!= null`                   | `!= null`                | emulated (D6)                                | emulated                 | `Astro.slots.has`       |
| `a ? <A /> : <B />`          | ternary                               | `v-if` / `v-else`         | `{#if}`                     | `<Show>`                 | `@if`                                        | ternary                  | ternary                 |
| `.map` + `key`               | `.map` + `key`                        | `v-for`                   | `{#each … (key)}`           | `<For>`                  | `@for (track)`                               | `.map` + `key`           | `.map`                  |
| `v-model={x.value}`          | `value` + `onInput` (by input kind)   | `v-model`                 | `bind:value`                | `value` + `onInput`      | `[value]` + `(input)` or a `model()` binding | `bind:value`             | `value` (static)        |
| `class={[…]}`                | inline merge helper                   | native                    | native (clsx built in)      | inline merge helper      | `[class]`                                    | native                   | `class:list`            |
| Fallthrough attributes       | `...rest`                             | native                    | `...rest`                   | `splitProps`             | host, or a helper directive (D6)             | `...rest`                | `...rest`               |
| `import "./Button.css"`      | `import "./Button.css"`               | `<style>`                 | `import "./Button.css"`     | `import "./Button.css"`  | `styleUrl` + `ViewEncapsulation.None`        | `useStyles$`             | `import "./Button.css"` |
| `<component is>`             | `const Tag = …`                       | `<component :is>`         | `<svelte:element>`          | `<Dynamic>`              | `@switch` over the known tags                | `const Tag = …`          | `const Tag = …`         |
| `useId()`                    | `useId`                               | `useId`                   | `$props.id()`               | `createUniqueId`         | helper                                       | `useId`                  | helper                  |

**The hard cells.** Each of these has its own semantic cases in the corpus:

- **React:** the function body re-runs on every render, so setup-once snapshots, stale closures and
  batching all need care (§4.5).
- **Angular:**
  - inputs are read before they are set
  - there is no attribute spread
  - host elements wrap the root
  - named and scoped projection needs templates
- **Qwik:** QRL capture rules, `track` inside tasks, and the event order around `preventDefault`.
- **Astro:** there is no client runtime.

---

## 7. Testing strategy

This is the centre of the plan. The compiler is only as good as the evidence that its seven outputs
behave the same.

### 7.1 The integration case

```
tests/integration/cases/state/counter/
├── Counter.uf.tsx                         the one input (plus Counter.css, and harness .uf.tsx files if needed)
├── counter.test.ts                        one spec, run once per target
├── __output__/
│   ├── ir.json                            target-independent IR snapshot (schema-validated)
│   ├── react/Counter.tsx                  golden outputs: formatted, reviewed in PRs,
│   ├── vue/Counter.vue                    and type-checked and linted in place
│   ├── svelte/Counter.svelte
│   ├── solid/Counter.tsx
│   ├── angular/counter.ts
│   ├── qwik/Counter.tsx
│   └── astro/Counter.astro
├── __expected__/                          target-independent expectations, shared by all seven
│   ├── ssr.default.html
│   ├── dom.initial.html
│   ├── aria.initial.yaml
│   └── trace.increments.json
└── __screenshots__/initial-chromium-linux.png      one baseline, compared by all seven
```

```ts
// counter.test.ts: written once, runs on every target
import { describeTargets, mount } from "@unframework/testing";
import Counter from "./Counter.uf.tsx";

describeTargets("counter", () => {
  it("renders the initial value", async () => {
    const view = await mount(Counter, { props: { initial: 2 } });
    await expect.element(view.getByRole("status")).toHaveTextContent("2");
    await view.expectParity("initial"); // DOM, ARIA tree, geometry and pixels vs the shared expectation
  });

  it("increments and emits the new value", { requires: ["interactivity"] }, async () => {
    const view = await mount(Counter, { props: { initial: 2, step: 3 } });
    await view.user.click(view.getByRole("button", { name: "+3" }));
    await expect.element(view.getByRole("status")).toHaveTextContent("5");
    expect(view.emitted("change")).toEqual([[5]]);
    await view.expectParity("after-increment");
  });
});
```

`requires` skips a test on any target whose capability matrix lacks the feature, here Astro. The skip
carries that reason into the parity matrix (§7.7).

### 7.2 Verification layers

| #   | Layer               | What it asserts                                                                                                                                                    | Tooling                                                                                                                                             | Live from                  |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| L1  | Diagnostics         | Expected diagnostics exactly, nothing unexpected. Fixes apply and the result recompiles clean.                                                                     | compiler                                                                                                                                            | M0                         |
| L2  | Golden output       | The IR and all seven outputs match `__output__`. The IR validates against the schema. Output is formatted and deterministic: compiling twice gives the same bytes. | `toMatchFileSnapshot`                                                                                                                               | M0                         |
| L3  | Framework compile   | Each output is accepted by its framework's own compiler with zero warnings.                                                                                        | `@vue/compiler-sfc`, `svelte/compiler`, ngtsc AOT with strict templates, the Qwik optimizer, the Solid compiler, React Compiler, the Astro compiler | M0                         |
| L4  | Types               | Outputs type-check. A consumer file that misuses a prop, event, model or slot must fail on every typed target.                                                     | tsgo, vue-tsc, svelte-check, ngc, `astro check`                                                                                                     | M0; consumer tests from M3 |
| L5  | Idiom and lint      | Framework lint rules pass with zero warnings. Conformance invariants are AST-based, not substring checks.                                                          | oxlint, eslint-plugin-react-hooks, -solid, -vue, -svelte, angular-eslint, -qwik, -astro                                                             | M1                         |
| L6  | SSR parity          | Normalised server HTML equals `__expected__/ssr.*.html` on every target.                                                                                           | each framework's server renderer, and the Astro Container API                                                                                       | M0                         |
| L7  | DOM and a11y parity | The client-rendered DOM (with form-control properties) and the accessibility tree equal the shared expectations.                                                   | Vitest Browser Mode with Playwright (Chromium)                                                                                                      | M0                         |
| L8  | Behaviour           | The spec's own assertions: text, emitted events, model updates, focus, rerendering with new props.                                                                 | `@unframework/testing`                                                                                                                              | M1                         |
| L9  | Interaction traces  | After every scripted step, the normalised DOM, ARIA tree and event log equal the shared trace.                                                                     | the `@unframework/testing` recorder                                                                                                                 | M2                         |
| L10 | Visual parity       | Element geometry and selected computed styles match first, because they explain a difference. Then pixels match the one shared baseline.                           | `toMatchScreenshot` and a geometry snapshot                                                                                                         | M0                         |
| L11 | Accessibility       | axe-core reports zero violations, or exactly the declared list.                                                                                                    | axe-core in the browser                                                                                                                             | M0                         |
| L12 | Hydration           | Server render, then hydrate: no mismatch warnings, the DOM equals the client render, and interactions still work.                                                  | each framework's hydrate API                                                                                                                        | M8                         |
| L13 | Runtime hygiene     | No `console.error` or `console.warn` during mount or interaction (React keys, Vue warnings, `NG0…` codes) unless allowlisted with a reason.                        | console capture                                                                                                                                     | M0                         |
| L14 | Source maps         | Positions round-trip to `.uf.tsx`, and a thrown error's stack points at the authored line.                                                                         | a source-map consumer                                                                                                                               | M6                         |
| L15 | Budgets             | Compile time per case, and output size per target with the framework externalised, stay within budget.                                                             | tinybench, rolldown                                                                                                                                 | M6                         |

### 7.3 Harness architecture

```
tests/integration/vitest.config.ts   (Vitest 5 projects)
├── compile              node      L1 L2  compile every case to all seven targets; write or compare __output__
├── toolchain:<target>   node ×7   L3 L4 L5  one tsgo / vue-tsc / svelte-check / ngc / astro check run per
│                                  target over all the __output__ trees, not one run per case
├── ssr:<target>         node ×7   L6     render each case's SSR scenarios and compare to __expected__
└── browser:<target>     chromium ×7  L7–L11, L13  the same *.test.ts files; `./Counter.uf.tsx` resolves
                                   through the unplugin with { target }, then that framework's own Vite plugin
```

- **One toolchain per project.** A browser project's plugins are
  `[unframework({ target }), ...toolchain.vitePlugins()]`, so React, Solid and Qwik never share a JSX
  transform.
- **The browser tests run the reviewed code.** A guard asserts that the plugin's output equals the
  committed golden file.
- **Mount adapters.** `@unframework/testing/<target>` provides:
  - `mount(component, { props, slots, models, on })`
  - `getBy*` queries that return Vitest locators
  - `user`, which sends real CDP events
  - `emitted(name)`, `model(name)`, `rerender(props)` and `unmount()`
  - a settle hook: React `act`, Angular `whenStable`, Qwik resume, flushed microtasks

  Slot content is either a string or a harness `.uf.tsx` component compiled to the same target, which
  also exercises composition.

- **Astro.**
  - SSR runs through the Container API in Node.
  - The browser project mounts the server HTML for the DOM, visual and axe checks.
  - Interactive tests are skipped by capability.

### 7.4 One expectation, seven verifications

Vitest projects run in isolation, so targets are never compared with each other directly. Every target
is compared against the same target-independent artefacts (`__expected__/*` and `__screenshots__/*`).
If all seven equal the same file, they equal each other.

- **Writes.** CI never writes artefacts, and a missing artefact is a failure. In update mode
  (`pnpm test:update`), only the reference project writes, and every other target must then match.
- **The reference project is Vue (D10).** The source's semantics are Vue's.
- **The parity matrix.** Each run writes `parity-matrix.json`. It records, for every case, target and
  layer, one of `pass`, `fail`, `skip(reason)` or `quarantined(issue)`, and is rendered into the CI
  summary. Milestone exit criteria are stated as matrix states.

### 7.5 Normalisation

DOM, HTML and trace comparison normalises only framework noise. Each rule has its own unit test,
including a negative test proving it does not erase a real difference.

- **Comments.** Framework anchors are removed: `<!--v-if-->`, `<!--[-->`, Angular container and
  binding comments, and Qwik `qv` comments.
- **Attributes added by frameworks.** These are removed: `_ngcontent-*`, `_nghost-*`, `ng-reflect-*`,
  `ng-version`, `q:*`, `on:*`, `data-hk` and `data-astro-cid-*`. The compiler's own scope attributes are
  part of the contract and stay.
- **Angular host elements** are unwrapped while D6's `display: contents` strategy is in place.
- **Ordering.** Attributes are sorted, and class tokens are sorted.
- **Canonical forms.** Style declarations are parsed and canonicalised, and so are boolean attributes.
- **Whitespace** is collapsed by HTML's rendering rules. `pre`, `textarea` and `white-space` contexts
  are preserved.
- **Generated IDs** are canonicalised consistently across `id`, `for` and `aria-*` (`uf-id-1`, …).
- **Form-control state** (`value`, `checked`, `selected`, `indeterminate`) is serialised as
  pseudo-attributes, because React sets properties, not attributes.

### 7.6 Visual determinism

- **Fonts:** the harness bundles its own and never uses system fonts.
- **Motion:** animations, transitions and the caret are disabled, and `prefers-reduced-motion` is set.
- **Viewport:** a fixed size at DPR 1, in the light scheme. Dark-theme cases opt in.
- **Settling:** each capture waits for `document.fonts.ready` and the target's settle hook.
- **Baselines:**
  - CI's Linux Playwright image generates and holds the baselines.
  - Locally, a live mode compares the targets with each other in the same run and needs no baseline.
    v1 relied on that mode alone.
- **Tolerance:** zero pixel tolerance across targets by default, because the same browser and the
  same CSS should give the same pixels. Any tolerance is set per case, with a reason.

### 7.7 Keeping the tests honest

- **Canaries.** A test-only compiler plugin corrupts output in ways each layer must catch: a dropped
  attribute, a wrong text node, an unwired handler, a type error, a lint violation, a CSS change. The
  suite fails if any canary passes. This is ADR-009's anti-vacuity guard, applied to every layer.
- **No silent skips:**
  - Every skip names a capability or a quarantine entry.
  - A project that collects zero tests fails.
  - Every parity assertion checks how many targets it compared.
  - A toolchain that cannot start fails.
- **The quarantine only shrinks.** `quarantine.ts` lists entries of the form (case, target, layer,
  reason, issue). Quarantined entries still run and must still fail. An entry that passes fails the
  suite until someone removes it.
- **Coverage gate.** It is derived from the corpus IR, not maintained by hand. Every node kind,
  attribute kind, binding kind, diagnostic code and native or emulated capability cell must have at
  least one case on every target.

### 7.8 The corpus

The counts below are targets for each milestone's exit. Every case runs on all seven targets.

| Milestone | Areas and examples                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Cases |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| M0        | `basics/hello`, `basics/nested-and-void`, `diagnostics/framework-import-rejected`                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 3     |
| M1        | **Props:** primitives, destructured defaults, optional, local interfaces, literal unions, the `props` parameter.<br>**JSX:** expressions, escaping, JSX whitespace, SVG, attribute names, boolean and `aria-*` attributes, fragments.<br>**Bindings:** `class` (string, array, object, merge), `style` (object, string, merge), spreads.<br>**Control flow:** ternary chains, `&&`, keyed and indexed `.map`, nesting, empty lists.                                                                                                     | 30    |
| M2        | **State:** counter, object and array replacement, read-after-write, computed chains, computed-after-write, setup-once snapshots, props seeding state (the Angular input trap), new props updating derived values.<br>**Events:** function and inline handlers, event options, keys, emit payloads, async handlers.<br>**Effects:** previous value, immediate, cleanup, order.<br>**Lifecycle:** DOM access when mounted, unmount cleanup of timers, parent/child order.<br>**Other:** template refs (focus), `useId` label association. | 35    |
| M3        | **Components:** props, events, three-level nesting, recursion.<br>**Slots:** default (children), named and scoped (slot objects), fallback, presence, inside `.map`, forwarding.<br>**Models:** every native input kind, modifiers, component `v-model`, unbound local state, multiple models.<br>**Fallthrough:** root, class and style merge, `inheritAttrs: false`.<br>**Other:** expose (focus); context (static, reactive, default, nested); `<component is>` over `a` / `button`.                                                 | 45    |
| M4        | Scoped basics, child root, `:deep`, `:slotted`, `:global`, custom properties from JSX, layers, media queries, hover and focus-visible states, Styleframe recipes, tokens and a dark theme, Open Components data-attribute variants.                                                                                                                                                                                                                                                                                                     | 25    |
| M5        | Imported interfaces, `extends` chains, utility types, package types, generic components, consumer typing probes (stock tsgo and the content mapper), composables (`useToggle`, `useControllableState`, `useMediaQuery`), shared modules, type-change invalidation.                                                                                                                                                                                                                                                                      | 25    |
| M8        | Transitions, teleport, async setup, `innerHTML`, portable directives (click-outside, focus-trap), hydration, keyed reorder keeping focus.                                                                                                                                                                                                                                                                                                                                                                                               | 30    |
| M10       | Design-system acceptance:<br>• the Open Components Button, with its spec's test suite ported<br>• Inkline's 8 families: badge, button, checkbox, field-group, hamburger-menu, input, radio, switch<br>• tabs, dialog, accordion and menu/listbox                                                                                                                                                                                                                                                                                        | 40    |

### 7.9 CI

- **Jobs:**
  - unit tests for each package
  - `integration:compile`
  - `integration:toolchains`, a ×7 matrix
  - `integration:ssr`
  - `integration:browser`, a ×7 matrix, sharded (M0 runs one job per target; the parity summary
    accepts a complete set of shards per project, ADR-0029)
  - visual baselines in the Linux Playwright image
  - e2e and bench, both from M6
- **Pinning:** actions are pinned by SHA, and Node is 24, as in today's workflows. Turbo caches by
  inputs.
- **Wall-clock budget:** under 15 minutes for about 250 cases. Sharding, and one checker run per target
  rather than one per case, keep it there.
- **Artefacts:** the parity matrix, visual diffs, and Vitest trace views for failures.
- **No retries.** A parity failure is never retried. A flaky parity test is a bug in the compiler or
  the harness.

---

## 8. End-user tooling

### 8.1 Configuration

```ts
// unframework.config.ts
import { defineConfig } from "unframework/config";

export default defineConfig({
  targets: ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"],
  srcDir: "src",
  outDir: "dist",
  targetOptions: { react: { compiler: true } }, // validated per target (Standard Schema)
  typeOracle: "syntactic", // or "tsgo"
  strict: false, // true: portability warnings become errors
});
```

### 8.2 The bundler plugin

`@unframework/unplugin` covers Vite, Rolldown, Rollup, webpack, Rspack/Rsbuild, esbuild and Bun.

- **App mode.** A React app imports `Button.uf.tsx` and receives React.
- **Virtual ids.**
  - The plugin runs with `enforce: "pre"`.
  - Each import resolves to a virtual id with the target's native extension: `…/Button.uf.tsx.vue`,
    `….svelte`, `….astro`. For JSX targets, the `.tsx` id is kept.
  - The host framework's own plugin finishes the job: React Compiler, plugin-vue, vite-plugin-svelte,
    the Solid compiler, the Qwik optimizer or Astro. Angular is the exception: Analog compiles only
    the files of its TypeScript program on disk, so the Angular path ships its own ngtsc step for
    virtual modules ahead of Analog (ADR-0021, ADR-0027).
  - v1's plugin got this wrong: it handed SFC source to plugins that never looked at it.
- **Target selection** is explicit, or detected from whichever framework plugin is installed, for all
  seven frameworks.
- **HMR** goes through the framework's own HMR. The plugin also invalidates dependents when a type
  dependency changes.
- **Integrations:**
  - Astro, through an Astro integration.
  - Nuxt, SvelteKit, SolidStart, Qwik City and Analog, through Vite.
  - The Angular CLI (`@angular/build`) has no plugin API, so Angular apps consume a prebuilt package or
    use Analog.
- **Type-checking `.uf.tsx` inside a host app** needs `jsxImportSource: "unframework"` for those files,
  through a scoped tsconfig or the per-file pragma. M6 settles which.

### 8.3 CLI

| Command                      | What it does                                                            |
| ---------------------------- | ----------------------------------------------------------------------- |
| `unframework build`          | Compiles a design system to `dist/<target>/`, with packaging (§8.4).    |
| `unframework check`          | Reports diagnostics only. `--format json` or `sarif` for agents and CI. |
| `unframework test`           | Runs the user's cross-target tests (§8.5).                              |
| `unframework visual`         | Runs visual parity over the examples (§8.6).                            |
| `unframework preview`        | Shows every example in all seven frameworks side by side.               |
| `unframework manifest`       | Writes `components.json` (§8.8).                                        |
| `unframework explain UF2103` | Prints a diagnostic's documentation.                                    |
| `unframework fix`            | Applies the `safe` fixes.                                               |
| `unframework init`           | Scaffolds a config, an example component, tests and `AGENTS.md`.        |

### 8.4 Distribution

`unframework build` writes idiomatic source for each target. With `--package`, it also runs each
framework's official packager:

| Target       | Packaged as                             |
| ------------ | --------------------------------------- |
| React, Solid | JS + `.d.ts`, through tsdown            |
| Vue          | SFC + `.d.ts`                           |
| Svelte       | svelte-package                          |
| Angular      | ng-packagr (the Angular Package Format) |
| Qwik         | a Qwik library build                    |
| Astro        | sources                                 |

It also generates `exports` for subpath packages (`my-ds/react`, `my-ds/vue`, …) and barrel files.
Consumers of a published package get each framework's native types for free.

### 8.5 `@unframework/testing`

This is the API the corpus is written in. It is published once it is stable (M7), and it includes:

- `describeTargets`, `mount`, `View` and `expectParity`
- trace recording and SSR rendering
- axe and ARIA matchers
- `defineTestConfig({ targets })`, a Vitest 5 preset that builds the per-target browser and SSR
  projects

A design-system team tests its own components exactly the way Unframework tests the compiler.

### 8.6 `@unframework/visual`

- **Examples** are `*.example.uf.tsx` files. They are components with no props, so they are portable
  by construction.
- **The runner** renders every example on every target through the same browser projects. It compares
  geometry and computed styles, then pixels, either against one shared baseline or live, target
  against target.
- **The report** is a static HTML page with:
  - a seven-up grid for each example
  - a diff overlay
  - geometry deltas per target
- **`unframework preview`** is a shell page with one iframe per target (one Vite server each) and
  shared prop controls, for people and for agents taking screenshots.

### 8.7 Editors

`.uf.tsx` is TSX, so any TypeScript editor running tsgo type-checks component bodies from day one.
From M5, the content mapper (§5.6) adds the rest in the same editor: full consumer typing for events,
models and slots, plus the compiler's UF diagnostics, including portability for the selected targets.

### 8.8 Agent tooling

- **The component manifest** (`components.json`, with a versioned schema) records, for each component:
  - props, events, models and slots, with their types, defaults and docs (from JSDoc)
  - examples
  - per-target capabilities

  It drives docs, agent context, props tables and Open Components conformance.

- **The MCP server** offers `compile`, `check` (with fixes), `test` (returns the parity matrix),
  `screenshot` (images per target), `manifest` and `explain`.
- **Fixes** are machine-applicable edits with a confidence level, as ADR-001 required. Success is
  measured as time-to-green in agent evals.
- **`unframework init`** writes an `AGENTS.md` that describes the subset and the verify loop:
  `unframework check && unframework test`.
- **The Open Components rule pack** turns the standard's checklist IDs into diagnostics, such as
  `button/deterministic-dom` and `tokens/token-paths`. It also runs the standard's test suites across
  all seven targets.

---

## 9. Milestones

Every milestone ends with a green parity matrix for its cases, on all seven targets and at every live
layer. Sizes are relative effort: S is about a week, M two to three weeks, L four to six weeks.

| Milestone | Theme                                           | Size | Cases (cumulative)          |
| --------- | ----------------------------------------------- | ---- | --------------------------- |
| M0        | The walking skeleton: the verification machine  | L    | 3                           |
| M1        | Props and static JSX                            | M    | ~33                         |
| M2        | Reactivity, events and behaviour                | L    | ~68                         |
| M3        | Composition                                     | L    | ~113                        |
| M4        | Styling and visual parity                       | M    | ~138                        |
| M5        | Cross-file: types, consumer typing, composables | L    | ~163                        |
| M6        | Build integration and distribution              | L    | ~163, plus e2e apps         |
| M7        | Public testing and visual tooling               | M    | (the corpus on public APIs) |
| M8        | Advanced features and versioned targets         | L    | ~193                        |
| M9        | Agent tooling                                   | M    | -                           |
| M10       | Design-system acceptance and 1.0                | L    | ~233                        |

**How the work fans out.** After M0, each milestone splits into a core lane (parser, analyzer, IR),
seven target lanes and a harness lane, which suits parallel agents. The loop for each feature is:

1. Write the case and its expected artefacts. They come from the Vue reference, and someone reviews
   them.
2. Quarantine the case on every target that isn't there yet.
3. Each target lane turns its column green, and the quarantine shrinks.

**A feature is done when it has:**

- an entry in the semantics contract
- a capability cell for each target
- corpus cases that are green, or declared
- misuse diagnostics, with fixes where one exists
- a docs page
- an updated IR schema and manifest

### M0. The walking skeleton (L)

**Goal:** the whole verification machine, end to end, around components with no features.

**Repo:**

- Add `!packages/compiler-v1` and `tests/*` to `pnpm-workspace.yaml`. v1's `catalog:` dependencies
  would otherwise break `pnpm install`.
- Add the package template, turbo tasks and CI jobs.
- Seed `docs/adrs/` with the decisions in §11.

**Packages, minimal:**

- `parser`
- `ir`: Element, Text and static attributes
- `diagnostics`
- `codegen`: the printer, the markup builder and the oxfmt step
- the seven `target-*` packages, each with a toolchain
- `compiler`
- `unframework`, with the authoring stubs and the vendored JSX types
- `unplugin`, for Vite only
- `testing`, private: all seven mount adapters, the SSR renderers and normalisation

**Spikes,** timeboxed, each ending in an ADR:

1. One Vitest 5 run with seven browser projects. The React, Solid and Qwik JSX transforms, Analog
   (Angular) and the Qwik optimizer must coexist.
2. Shared screenshot baselines across projects.
3. The Astro Container API in Node, and static mounting in the browser.
4. Virtual ids through each framework's Vite plugin, with `enforce: "pre"` ahead of the JSX plugins.
5. TypeScript 6 checkers beside TypeScript 7 in one workspace.
6. `.uf.tsx` under tsgo:
   - The `unframework` JSX types raise no false errors on consumers.
   - Probe tests pin what the types do and do not catch.
   - Find out whether a TS 7.1 content mapper (7.1 nightly) can claim `.uf.tsx`.

**Cases:** `basics/hello`, `basics/nested-and-void`, `diagnostics/framework-import-rejected`.

**Exit:**

- `pnpm install && pnpm test` passes on a clean clone and in CI.
- L1–L4, L6, L7, L10, L11 and L13 are live for 3 cases × 7 targets.
- Every live layer has a canary, and each one fails as expected.
- `parity-matrix.json` appears in the CI summary.
- CI runs in under 10 minutes.

### M1. Props and static JSX (M)

**Scope:**

- Signature props: type literals, local interfaces and aliases, destructured defaults, and the `props`
  parameter.
- Lowering JSX to templates for every target: ternary chains, `&&`, `.map` (keyed, indexed, nested)
  and fragments.
- Attribute names and casing per target; `aria-*` and `data-*`; escaping.
- `class` and `style` in every form, and spreads.
- SVG.
- JSX whitespace.
- The Angular host strategy, decided here (D6).

**Exit:** about 30 cases green at L1–L7, L10, L11 and L13. L5 (lint) and L8 (static behaviour
assertions) go live.

### M2. Reactivity, events and behaviour (L)

**Scope:**

- `ref`, `computed`, `watch`, `watchEffect`, `onMounted`, `onUnmounted` and `nextTick`.
- Local functions and constants, in source order.
- Events with options, inline handlers and keys.
- `defineEmits`.
- Template refs and `useId`.
- Version 1 of the semantics contract, including:
  - React: setup-once snapshots, local shadows and mirror refs
  - Angular: input timing
  - Qwik: `track` and QRL rules

**Exit:**

- About 35 new cases are green.
- L8 and L9 are live, with interaction traces identical across the six interactive targets.
- Astro is declared static, and its skips are visible in the matrix.

### M3. Composition (L)

**Scope:**

- Child components.
- Slots:
  - `defineSlots`
  - children and slot objects
  - fallback content and presence
- `defineModel` and `v-model` on every native input kind and on components.
- Fallthrough, including `inheritAttrs`.
- `defineExpose` and component refs.
- `provide` / `inject` with `InjectionKey`, including reactive values.
- `<component is>` over known sets.
- Layer 2 of §5.6: the compiler's cross-component checks.

**Exit:**

- About 45 new cases are green.
- L4 consumer type tests are live on the outputs. A misused prop, event, model or slot fails
  type-checking on every typed target, mapped back to `.uf.tsx`.

### M4. Styling and visual parity (M)

**Scope:**

- Compiler-owned scoping: child root, `:deep`, `:slotted` and `:global`.
- Custom properties, layers and media queries.
- Styleframe in the unplugin and in the test projects.
- Tokens and theming.
- Baselines generated in Linux CI.
- Geometry and computed-style parity.
- A licence-free Styleframe mode or stub for CI.

**Exit:** about 25 new cases with zero cross-target pixel difference in Chromium. Firefox and WebKit run
nightly.

### M5. Cross-file: types, consumer typing and composables (L)

**Scope:**

- The syntactic `TypeOracle`: imports across files and packages, `extends` and utility types.
- Generic components: `function List<T>(props: ListProps<T>)`.
- Exported public types for each target.
- The `tsgo` adapter on `typescript/unstable/sync`, ported to the stable 7.1 API once it ships (planned
  for Nov 24, 2026).
- Consumer typing layers 1 and 3 (§5.6): JSX types with probe tests, and
  `@unframework/language-tools` as a content mapper.
- `*.uf.ts` composables compiled for each target.
- Shared modules.
- The project graph and incremental invalidation.

**Exit:**

- The oracle contract suite is green on both adapters.
- Consumer misuse of events, models and slots is caught:
  - by tsgo with the content mapper
  - by the compiler without it
  - with no false errors under stock tsgo
- About 25 new cases are green.
- Changing an imported props type recompiles exactly its dependents.

### M6. Build integration and distribution (L)

**Scope:**

- The unplugin on every bundler, plus the Astro integration, and HMR.
- The CLI (`build`, `check`, `explain` and `init`) and `unframework.config.ts`.
- Per-target packaging (§8.4).
- Source maps end to end (L14), and budgets (L15).
- `tests/e2e`: seven real apps consuming a sample design system.
- `create-unframework`.

**Exit:**

- The sample design system installs from packed tarballs and renders in all seven apps.
- Each app also works in plugin mode where its framework allows: six of them, with Angular using the
  package.
- Every app has Playwright smoke and HMR tests.
- A runtime error's stack trace maps to `.uf.tsx` on every target.

### M7. Public testing and visual tooling (M)

**Scope:**

- Publish `@unframework/testing`: `describeTargets`, `mount`, the matchers and `defineTestConfig`.
- `unframework test`.
- `@unframework/visual`: example discovery, the runner and the HTML report.
- `unframework preview`.
- Documentation.
- A stretch goal: property-based interaction fuzzing that compares traces across targets.

**Exit:**

- The corpus uses public APIs only, enforced by a lint rule.
- The sample design system's tests and visual suite run in CI from published-shape packages.

### M8. Advanced features and versioned targets (L)

**Scope:**

- `<Transition>` and `<Teleport>`.
- Async setup.
- `innerHTML`.
- Portable directives.
- Hydration (L12) on every target that hydrates.
- The Solid 2 target variant, once 2.0 is stable.
- Vue 3.6 Vapor as a target option.
- A review of the Qwik decision (D7).

**Exit:**

- Each feature has a capability cell and cases.
- `solid@2` passes the whole corpus as an additive package. This is timed as the "eighth framework
  drill".

### M9. Agent tooling (M)

**Scope:**

- Version 1 of the component manifest schema.
- The MCP server.
- `safe` and `likely` fixes for the most frequent diagnostics, and `unframework fix`.
- `llms.txt` and docs generation.
- The `AGENTS.md` template.
- The Open Components rule pack.

**Exit:** an agent eval set of about 20 tasks, such as "add a `loading` state to Button", reaches green
parity through MCP within a set number of attempts. Time-to-green is recorded as the baseline.

### M10. Design-system acceptance and 1.0 (L)

**Scope:**

- Port Inkline's 8 component families. v1 sources are TSX too, so a codemod does most of the work:
  - `createSignal` → `ref`
  - `<Show>` → ternary
  - `<For>` → `.map`
  - `$bind:` → `v-model`
  - `defineSlot` / `<Slot>` → `defineSlots` / `slots.x?.()`
- The Open Components Button, with its spec's suite run on all seven targets.
- Tabs, dialog, accordion and menu/listbox.
- Performance budgets.
- The docs site.
- Frozen export tiers (ADR-002).
- Changesets and publishing.

**Exit:** the acceptance corpus is green at every layer on every target, and the quarantine is empty.
Then `1.0.0` ships.

---

## 10. Risks

| ID  | Risk                                                                                                                                            | Mitigation                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | React re-runs the body on every render, which diverges from setup-once Vue semantics: snapshots, stale closures, batching, effects after paint. | Snapshots, shadows and mirror refs driven by escape analysis, with dedicated `semantics/*` cases. Correctness beats idiom, and idiom wins whenever both hold. |
| R2  | Consumers cannot type macro-declared events, models and slots under plain TypeScript (v1's ADR-010 problem).                                    | The four layers in §5.6. Probe tests pin what each layer catches, and output type tests are the backstop.                                                     |
| R3  | A content mapper may not be able to claim `.uf.tsx`, or 7.1 may slip.                                                                           | M0 spike 6. A distinct extension is the fallback. Layers 1, 2 and 4 work without the mapper.                                                                  |
| R4  | JSX is more expressive than template languages: JSX in variables, helpers returning JSX, arbitrary JS in the tree.                              | The subset rules in §4.3 and §4.6, with diagnostics and fixes. Vue's output uses templates, never JSX.                                                        |
| R5  | Angular: input timing, host elements, no attribute spread, projection through templates.                                                        | Spikes in M0 and M1, helper directives declared as "emulated", and D6.                                                                                        |
| R6  | Qwik 2 is still in beta (47 betas, no date), and its QRL capture rules are strict.                                                              | The target is marked experimental and pinned exactly. The corpus runs the real optimizer. D7 is reviewed in M8.                                               |
| R7  | Solid 2.0 is a release candidate with different APIs.                                                                                           | Versioned targets: `solid@1` now, `solid@2` as an additive variant.                                                                                           |
| R8  | The Vue, Svelte, Astro and Angular checkers need TypeScript 6.                                                                                  | Confined to `tests/toolchains/*`. Each one moves when its content mapper or ngp ships.                                                                        |
| R9  | Browser tests get slow or flaky at about 250 cases × 7 targets.                                                                                 | One checker run per target, sharding, settle hooks, no retries on parity failures, and trace views for failures.                                              |
| R10 | Visual drift from fonts or the OS.                                                                                                              | Bundled fonts, Linux baselines in CI, and the live cross-target mode locally.                                                                                 |
| R11 | Styleframe builds require a licence.                                                                                                            | A CI licence or a deterministic stub, decided in M4.                                                                                                          |
| R12 | Interplay between the bundler plugin and framework plugins: ordering, virtual ids, HMR.                                                         | M0 spike 4, and M6's e2e app for each framework.                                                                                                              |
| R13 | Scope creep: 7 targets × every feature.                                                                                                         | A feature can ship as "unsupported on X" with a diagnostic. Each milestone defines its matrix cells.                                                          |
| R14 | oxfmt's support for the SFC formats.                                                                                                            | Markup is never formatted: the printer's whitespace-safe layout is the output, and oxfmt formats code only (ADR-0026). L2 checks formatting idempotence.      |

---

## 11. Decisions

### Confirmed (2026-10-01)

| ID  | Decision                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Component shape:** a setup-once function in JSX. Props are in the signature, the body is the setup, and the last statement returns the JSX.        |
| C2  | **Control flow:** plain JS (ternaries, `&&`, `.map`), with `v-model` as the only directive.                                                          |
| C3  | **Public API:** Vue macros in the body (`defineEmits`, `defineModel`, `defineSlots`, `defineExpose`). Consumer typing comes from the layers in §5.6. |
| C4  | **Styles:** a sibling CSS file, imported by the component and scoped by the compiler.                                                                |

### To confirm

Each of these becomes an ADR in `docs/adrs/` once it is confirmed. The plan proceeds on the
recommendation unless told otherwise.

| ID  | Decision                          | Recommendation                                                                                                                      | Alternatives                                                |
| --- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| D1  | Source extension                  | `.uf.tsx` for components and `.uf.ts` for composables                                                                               | plain `.tsx` with include globs; `.uf` with the TSX grammar |
| D2  | Authoring import and JSX runtime  | `unframework`, with `jsxImportSource: "unframework"`                                                                                | macros as globals, with no import                           |
| D3  | Canonical forms                   | Destructured signature props, named models, children for the default slot and a slot object for the others, one channel per concern | accept every Vue JSX form (`v-slots`, `withModifiers`)      |
| D4  | State updates                     | Values are replaced whole. Mutating a ref's contents in place is an error, with a fix.                                              | `reactive()` and deep mutation (immer-style lowering)       |
| D5  | CSS scoping algorithm             | Vue's attribute algorithm, applied by the compiler on every target                                                                  | CSS Modules-style class hashing                             |
| D6  | Angular host element              | An element selector with a `display: contents` host, unwrapped in normalisation. Attribute selectors as an option.                  | attribute selectors by default                              |
| D7  | Target versions                   | React 19, Vue 3.5 (3.6-compatible), Svelte 5, Solid 1.9 then 2, Angular 22, Qwik 2 (experimental), Astro 7 (static)                 | Qwik 1.x; Solid 2 only                                      |
| D8  | Output event and model names      | React and Solid `onChange` / `onOpenChange`; Svelte `onchange`; Qwik `onChange$`; Angular `output()` / `model()`                    | camelCase everywhere, including Svelte                      |
| D9  | Visual baselines                  | Linux baselines in CI, plus a live cross-target mode                                                                                | live mode only, as in v1                                    |
| D10 | Reference target for expectations | Vue                                                                                                                                 | hand-written expectations only                              |
| D11 | Runtime                           | None. Inline helpers only where a framework lacks a primitive.                                                                      | a tiny `@unframework/runtime-<target>`                      |
| D12 | Package naming                    | `unframework` (the umbrella and the authoring API) plus `@unframework/*`                                                            | everything scoped                                           |
| D13 | JSX attribute and event names     | HTML and Vue names (`class`, `for`, `onKeydown`), vendored from `@vue/runtime-dom`'s JSX types                                      | React names (`className`, `htmlFor`, `onKeyDown`)           |

---

## Appendix A: golden output sketches

These are the intended outputs for the `Counter.uf.tsx` in §4.1, written by hand to make each target's
idiom concrete. They are a starting point for review, not final golden files.

**React.** The source is already TSX, but React re-runs the function on every render. `ref` becomes
state, and the read that follows the write goes through a local, because React state stays stale until
the next render.

```tsx
import { useMemo, useState } from "react";
import "./Counter.css";

export interface CounterProps {
  initial?: number;
  step?: number;
  onChange?: (value: number) => void;
}

export default function Counter({ initial = 0, step = 1, onChange }: CounterProps) {
  const [count, setCount] = useState(initial);
  const doubled = useMemo(() => count * 2, [count]);

  function increment() {
    const nextCount = count + step;
    setCount(nextCount);
    onChange?.(nextCount);
  }

  return (
    <div className="counter" data-uf-c3a1>
      <output data-uf-c3a1>{count}</output>
      {doubled > 10 ? <span data-uf-c3a1>Big</span> : null}
      <button type="button" onClick={increment} data-uf-c3a1>
        +{step}
      </button>
    </div>
  );
}
```

**Vue.** The returned JSX is lowered to a template, where Vue unwraps refs, so `.value` disappears.

```vue
<script setup lang="ts">
import { computed, ref } from "vue";

export interface CounterProps {
  initial?: number;
  step?: number;
}

const { initial = 0, step = 1 } = defineProps<CounterProps>();
const emit = defineEmits<{ change: [value: number] }>();

const count = ref(initial);
const doubled = computed(() => count.value * 2);

function increment() {
  count.value += step;
  emit("change", count.value);
}
</script>

<template>
  <div class="counter" data-uf-c3a1>
    <output data-uf-c3a1>{{ count }}</output>
    <span v-if="doubled > 10" data-uf-c3a1>Big</span>
    <button type="button" data-uf-c3a1 @click="increment">+{{ step }}</button>
  </div>
</template>

<style src="./Counter.css"></style>
```

The scope attribute (`data-uf-c3a1`) and the stylesheet attachment are shown once here and left out of
the sketches below.

**Svelte**

```svelte
<script lang="ts">
  import "./Counter.css";

  interface Props {
    initial?: number;
    step?: number;
    onchange?: (value: number) => void;
  }

  let { initial = 0, step = 1, onchange }: Props = $props();

  let count = $state(initial);
  const doubled = $derived(count * 2);

  function increment() {
    count += step;
    onchange?.(count);
  }
</script>

<div class="counter">
  <output>{count}</output>
  {#if doubled > 10}
    <span>Big</span>
  {/if}
  <button type="button" onclick={increment}>+{step}</button>
</div>
```

**Solid**

```tsx
import { createMemo, createSignal, mergeProps, Show } from "solid-js";

export interface CounterProps {
  initial?: number;
  step?: number;
  onChange?: (value: number) => void;
}

export default function Counter(rawProps: CounterProps) {
  const props = mergeProps({ initial: 0, step: 1 }, rawProps);
  const [count, setCount] = createSignal(props.initial);
  const doubled = createMemo(() => count() * 2);

  function increment() {
    setCount(count() + props.step);
    props.onChange?.(count());
  }

  return (
    <div class="counter">
      <output>{count()}</output>
      <Show when={doubled() > 10}>
        <span>Big</span>
      </Show>
      <button type="button" onClick={increment}>
        +{props.step}
      </button>
    </div>
  );
}
```

**Angular.** Inputs are set after construction, so the state is seeded in `ngOnInit`. A naive
`signal(this.initial())` field would capture the default instead. The `state/props-seed-state` case
exists to catch exactly that.

```ts
import { Component, computed, input, output, signal, type OnInit } from "@angular/core";

@Component({
  selector: "uf-counter",
  host: { style: "display: contents" },
  template: `
    <div class="counter">
      <output>{{ count() }}</output>
      @if (doubled() > 10) {
        <span>Big</span>
      }
      <button type="button" (click)="increment()">+{{ step() }}</button>
    </div>
  `,
})
export class Counter implements OnInit {
  readonly initial = input(0);
  readonly step = input(1);
  readonly change = output<number>();

  protected readonly count = signal(0);
  protected readonly doubled = computed(() => this.count() * 2);

  ngOnInit(): void {
    this.count.set(this.initial());
  }

  protected increment(): void {
    this.count.update((count) => count + this.step());
    this.change.emit(this.count());
  }
}
```

**Qwik**

```tsx
import { $, component$, useComputed$, useSignal, type QRL } from "@qwik.dev/core";

export interface CounterProps {
  initial?: number;
  step?: number;
  onChange$?: QRL<(value: number) => void>;
}

export default component$<CounterProps>(({ initial = 0, step = 1, onChange$ }) => {
  const count = useSignal(initial);
  const doubled = useComputed$(() => count.value * 2);

  const increment = $(() => {
    count.value += step;
    onChange$?.(count.value);
  });

  return (
    <div class="counter">
      <output>{count.value}</output>
      {doubled.value > 10 ? <span>Big</span> : null}
      <button type="button" onClick$={increment}>
        +{step}
      </button>
    </div>
  );
});
```

**Astro.** The target is static. The compiler reports `onClick` as inert (UF4xxx, info), and the
case's interactive test is skipped by capability.

```astro
---
import "./Counter.css";

interface Props {
  initial?: number;
  step?: number;
}

const { initial = 0, step = 1 } = Astro.props;
const count = initial;
const doubled = count * 2;
---

<div class="counter">
  <output>{count}</output>
  {doubled > 10 ? <span>Big</span> : null}
  <button type="button">+{step}</button>
</div>
```

---

## Appendix B: v1 concept map

Both v1 and Unframework are TSX, so moving from one to the other is a mechanical codemod (M10).

| v1 (`.ink.tsx`)                           | Unframework (`.uf.tsx`)                                             |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `defineComponent(() => …)`                | `export default function Name(props: NameProps) { … }`              |
| `defineProps` (three channels)            | the signature's props type (one channel)                            |
| `createSignal(0)` → `[count, setCount]`   | `const count = ref(0)`, then `count.value = …`                      |
| `createMemo`                              | `computed`                                                          |
| `createEffect`                            | `watch` / `watchEffect`                                             |
| `onMount`, `onCleanup`                    | `onMounted`, `onUnmounted`, and the watcher's `onCleanup`           |
| `createRef` + `ref={inputRef}`            | `useTemplateRef()` + `ref={input}`                                  |
| `defineModel(name)`, `$bind:value`        | `defineModel(name)`, `v-model:name`                                 |
| `defineEmits`                             | `defineEmits`                                                       |
| `defineSlot`, `<Slot>`, `hasSlot`         | `defineSlots`, `slots.name?.()`, `slots.name`                       |
| `<Show>`, `<For>`, `<Switch>` / `<Match>` | ternaries and `&&`, `.map`, ternary chains                          |
| `createContext`, `provide`, `useContext`  | `InjectionKey`, `provide`, `inject`                                 |
| `<Transition>`                            | `<Transition>` (M8)                                                 |
| `meta: { headless: true }` (Angular only) | the Angular target option (D6)                                      |
| a sibling `.ink.css`                      | `import "./Button.css"`, scoped                                     |
| `createResource`                          | async setup (M8)                                                    |
| `batch`, `untrack`                        | not needed: writes batch per tick, and `watch` sources are explicit |
| JSX types vendored from Solid             | JSX types vendored from `@vue/runtime-dom` (D13)                    |

---

## Appendix C: version baseline

These are npm `latest` versions on 2026-10-01. Each target pins its tested range in
`framework.range`.

| Package                                   | Version           | Notes                                                                      |
| ----------------------------------------- | ----------------- | -------------------------------------------------------------------------- |
| typescript                                | 7.0.2             | 7.1 stable planned for Nov 24, 2026, with the API and content mappers      |
| @typescript/typescript6                   | 6.0.2             | for vue-tsc, svelte-check, `astro check` and Angular until they move       |
| react / react-dom                         | 19.3.0            | React Compiler 1.0                                                         |
| vue / @vue/runtime-dom                    | 3.5.43            | 3.6.0-rc.10 has Vapor; the JSX types are vendored from runtime-dom         |
| svelte                                    | 5.57.1            | async is still experimental, so output never uses it                       |
| solid-js                                  | 1.9.15            | 2.0.0-rc.13 (`@solidjs/web`)                                               |
| @angular/core                             | 22.2.1            | zoneless and OnPush by default; compiler-cli peers TypeScript `>=6.0 <6.1` |
| @qwik.dev/core                            | 2.0.0-beta.47     | `@builder.io/qwik` 1.20.1 is the v1 line                                   |
| astro                                     | 7.3.5             | a Rust compiler; the Container API serves SSR tests                        |
| vite / rolldown                           | 8.3.1 / 1.2.12    |                                                                            |
| vitest / @vitest/browser-playwright       | 5.0.3             | Browser Mode is stable; `toMatchScreenshot`                                |
| playwright                                | 1.63.0            |                                                                            |
| unplugin                                  | 3.4.0             | ten bundler factories                                                      |
| oxc-parser / oxc-transform / oxc-codegen  | 0.152.0           | TS-ESTree; isolated declarations; printing                                 |
| oxc-resolver                              | 11.24.2           |                                                                            |
| lightningcss                              | 1.33.0            | CSS parsing and selector scoping                                           |
| @typescript-eslint/scope-manager          | 8.71.0            | the analyzer's scope analysis (ADR-0035); exact, because it shapes the IR  |
| oxfmt                                     | 0.71.0            | programmatic `format()`                                                    |
| magic-string                              | 1.4.2             |                                                                            |
| tsdown                                    | 0.23.0            |                                                                            |
| axe-core                                  | 4.13.0            |                                                                            |
| oxlint / oxlint-tsgolint                  | 1.86.0 / 7.0.2003 | the repo's linter, and L5's baseline on every target (ADR-0042)            |
| eslint                                    | 10.11.0           | L5 for Vue, Svelte, Astro, Angular and Qwik's typed rules, on TypeScript 6 |
| typescript-eslint                         | 8.71.0            | peers TypeScript `<6.1`, so only the TypeScript 6 toolchains load it       |
| eslint-plugin-vue / vue-eslint-parser     | 10.11.1 / 10.4.1  | L5 for Vue                                                                 |
| eslint-plugin-svelte                      | 3.23.0            | L5 for Svelte                                                              |
| eslint-plugin-astro / astro-eslint-parser | 3.2.1 / 3.2.0     | L5 for Astro                                                               |
| @angular-eslint/eslint-plugin             | 22.5.0            | with `eslint-plugin-template` and `template-parser`: L5 for Angular        |
| eslint-plugin-solid                       | 0.18.0            | L5 for Solid, as an oxlint JS plugin                                       |
| eslint-plugin-qwik                        | 2.0.0-beta.47     | the `beta` tag (`latest` is Qwik 1's); typed rules in ESLint (ADR-0045)    |
| vue-jsx-vapor                             | 3.2.25            | prior art: Vue directives and macros in JSX                                |
