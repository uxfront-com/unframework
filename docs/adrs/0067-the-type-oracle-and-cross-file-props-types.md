# ADR-0067: The type oracle and cross-file props types

- **Status:** Proposed
- **Date:** 2026-10-24
- **Plan:** §4.2, §5.3, §5.5, §5.6 (layer 2), §6, §9 M5; P2, P5, P6, P8; R2, R3; ADR-0023,
  ADR-0034, ADR-0053, ADR-0055; amends ADR-0034 and ADR-0053

## Context

ADR-0034 reads a props type syntactically, from the component's own module only. An imported type,
an `extends` chain, an intersection and the utility types are UF1002, "lands in M5". Design systems
declare their props in shared `.ts` files and build them from one another, so M5 opens the props
type to other files and packages. Several forces shape how:

- **The seam is fixed.** Plan §5.5 defines `TypeOracle`, asynchronous and serialisable, with a
  syntactic adapter by default and a tsgo adapter on `typescript/unstable/sync`. TypeScript 7.0 has
  no stable API, and 7.1 is planned for 24 November 2026.
- **The analyser is synchronous and pure.** `compile()` already pre-resolves child APIs before it
  analyses (ADR-0053). Making the analyser await an oracle would break that.
- **Outputs keep the author's names.** A consumer of a design system imports `ButtonProps` by name.
  Printing a resolved shape into each output would drift from the author's names and docs.
- **Determinism (P8).** A shape records the files it read, so a path can't depend on a machine.
- **Layer 2 has a gap.** UF3039's literal check misses a union reached through an alias from the
  child's module.

## Decision

**The package.** `@unframework/type-oracle` holds the interface of §5.5 unchanged (`resolveShape`,
`printType`, `update` and `dispose`), the `TypeShape`, the syntactic adapter and the contract suite.

- **`TypeShape`** is a serialisable table of nodes, so recursive types work. It covers primitives,
  literals, unions, arrays, objects with members, functions, type parameters, and an opaque node for
  text it can't evaluate.
- **Each member** records `optional`, `readonly`, its declaring file and declaration, whether that
  is exported, the member's own span, its type's text as written with that text's span (all in the
  declaring file), and the names it references. Printed text is `printType`'s, on request, and is
  never stored as the member's text.
- **Each shape** lists its `construction` (`extends`, `intersection`, `utility:Pick`, `package`,
  `conditional`, …), its `dependencies` (root-relative files, and packages as `pkg:<name>`, never an
  absolute path) and its `unresolved` spans.

**The adapters:**

- **Syntactic, the default.** `createSyntacticOracle({ root, readFile })`, on oxc-parser and
  oxc-resolver. It resolves type literals, interfaces and aliases imported from a relative `.ts`, a
  child `.uf.tsx`, a `.uf.ts` or a package (through its `types` and `exports`), `extends` chains,
  intersections, unions, literal unions, the instantiation of generic declarations, and the five
  utility types of §5.5: `Partial`, `Required`, `Pick`, `Omit` and `Readonly`. `localShapes(parsed,
filename)` is its synchronous in-module path, which reads no file.
- **tsgo, opt-in.** `@unframework/type-oracle-tsgo`, on `typescript/unstable/sync`, pinned exactly
  at 7.0.2. Conditional and mapped types, `infer`, `keyof` and `typeof`, and template-literal holes
  resolve only here. It and the test toolchains are the only code that loads TypeScript's API.
- **The contract suite**, `@unframework/type-oracle/contract`, runs fixture projects with expected
  shapes against an adapter factory. Both adapters pass it. A construct the syntactic adapter can't
  evaluate comes back `unresolved`, never wrong.
- Global types other than TypeScript's lib types stay out.

**How the compiler reads shapes:**

- `analyzer` exports `shapeQueries(parsed)`: each props annotation, each type argument of
  `defineEmits`, `defineModel` and `defineSlots`, each `InjectionKey<…>`, and each setup annotation
  that names an imported type.
- `compile()` awaits `oracle.resolveShape` for each query, as it pre-resolves child APIs, and passes
  the map of shapes into `analyze`. Without the map, `analyze()` derives the module's own shapes
  through `localShapes`, so every direct caller works unchanged.
- `CompileOptions.typeOracle` is optional. Without it, `compile()` uses an in-process syntactic
  oracle over the one source, so a single-file compile behaves as today. `@unframework/compiler`
  re-exports `createSyntacticOracle`, and the harness and the unplugin build their file-backed
  oracle from it.
- Local props types move onto the same shapes, and every M1 to M4 golden stays byte-identical. The
  analyser's `TypeTable` stays for value kinds, and stops being read for props and child APIs.
- `CompileResult.dependencies` lists the files and packages a compile read (ADR-0071 consumes it).
- Child APIs come from shapes too: `createFileResolver` takes the oracle, and UF3039 reads aliases
  from the child's module.

**The IR** (`@unframework/ir`), every new field omitted when empty, so existing snapshots change
only where a field has content:

- `UfModule.typeImports`, and `UfModule.typeExports` for what `TypeDeclaration.exported` can't hold:
  type re-exports, and exported types no component reaches. `UfExport` stays components only.
- `Prop.declaredBy`, present only for a member from another declaration (inherited, intersected,
  picked or imported). For such a member, `Prop.type.code` is its type's text as written in the
  declaring file, `Prop.span` is the props annotation's span in the component's module, and
  `declaredBy` names the declaring file and the member's span there. The invariant that a
  `TypeText` is a slice of the module's source exempts it. A local member keeps its span and text.
- `references` on `ApiMember`, `ApiSlot.props`, `KeyApi.type` and `SlotDeclaration.props`, so a
  parent imports what it prints.

**How types reach each output:** re-imported by name, and never re-printed, except where a
framework's compiler must see the member keys.

| Target             | A type from a `.ts` module or a package                                                                                                                                       | From a child `.uf.tsx` | Members printed?                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------ |
| React, Solid, Qwik | `import type { X } from "<specifier as written>"`                                                                                                                             | `"./Field"`            | no                                   |
| Svelte             | in the instance script, or `<script module>` when exported                                                                                                                    | `"./Field.svelte"`     | no                                   |
| Astro              | in the frontmatter, aliased on import where a name clashes with `Props`                                                                                                       | `"./Field.astro"`      | no                                   |
| Vue                | `defineProps<X>()` where compiler-sfc resolves every construct (relative, `.vue`, `extends`, `&`, the five utilities), or else a printed literal with its references imported | `"./Field.vue"`        | only in that fallback                |
| Angular            | the source's own members keep their text, and an inherited member is `input<ButtonProps["tone"]>()`                                                                           | `"./field"`            | inherited members, by indexed access |

- An output that must name a type its module doesn't export is UF6003, with a `likely` fix that
  adds `export`.
- **Vue's printed fallback** (M5's Vue spike, in Evidence). Vue keeps `defineProps<X>()` when
  every construct the props type reaches is one compiler-sfc resolves through an `fs`: relative
  `.ts` and `.vue` imports, with or without an extension, `extends` chains across files,
  intersections, the five utilities, re-exports and `export *`, and the instantiation of a generic
  declaration. A props type that reaches a package, a namespace-qualified name (`T.ButtonProps`) or
  a conditional type takes the printed fallback, with its references imported.
- **Package types always take the fallback on Vue.** compiler-sfc resolves a package specifier
  only through TypeScript's classic API (`findConfigFile`, `resolveModuleName`, `sys`). TypeScript
  7.0's `typescript` module exports only `version` and `versionMajorMinor`, so with 7.0 installed
  every package import fails, and an output that works only on the consumer's TypeScript version
  would break the rule that outputs pass their framework's compiler.
- Vue's L3 passes an `fs` over the output tree to `compileScript`, and Vue's Vite projects pass
  one to `@vitejs/plugin-vue` as `script.fs`. plugin-vue passes none of its own, so with
  TypeScript 7.0 installed, `compileScript` has no file system and rejects every imported type.
- The script targets write their `import type` lines and re-exports through one codegen helper
  (`codegen/src/exports.ts`).

**The codes**, all errors: UF6001 `unresolved-type`, UF6002 `unsupported-type-construct` (whose
help names the tsgo adapter), UF6003 `type-not-exported`, UF6004 `props-not-object` and UF6005
`conflicting-members`.

**What it amends.** ADR-0034's props annotation accepts imported, extended, intersected and utility
types, and what it rejected as "lands in M5" becomes UF6001 to UF6005. ADR-0053's resolver reads
child APIs through the oracle.

## Consequences

**Positive:**

- Design-system props types work as written, across files and packages, on every target.
- Consumers keep `import type { ButtonProps }`, with the author's names and docs.
- The analyser stays synchronous and pure, and a single-file `compile()` needs no oracle.
- Moving to TypeScript 7.1's API means making the contract suite green on a new adapter (§5.5).

**Negative:**

- Two adapters and a contract suite to keep in step. The syntactic adapter refuses constructs that
  tsgo resolves, so a props type can compile under one oracle and fail under the other (UF6002).
- Vue's printed fallback and Angular's indexed-access inputs keep two shapes of output.
- `TypeTable` and shapes live side by side until a later issue retires `TypeTable`.
- A Vue project whose `typescript` is 7.0 needs `script.fs` in plugin-vue's options before any
  `defineProps<X>()` with an imported type compiles, Unframework's output or not. The docs page
  says so.

**Open:**

- The port of the tsgo adapter to TypeScript 7.1 stable is a separate issue, once 7.1 ships.

## Alternatives considered

- **Print every resolved shape into each output.** Printed types drift from the author's names and
  docs, and consumers lose `import type { ButtonProps }`. Printing stays only where a framework's
  compiler needs the keys: Vue's fallback and Angular's inherited inputs.
- **The oracle inside the analyser, made asynchronous.** The pre-query keeps `analyze` pure and
  synchronous, as the resolver does (ADR-0053).
- **tsgo as the default.** It resolves everything, but it needs a checker process on every compile
  and an API that is unstable until 7.1 (§5.5). The syntactic adapter covers almost every
  design-system props type with no process.

## Evidence

M5's Vue spike ran `@vue/compiler-sfc` 3.5.43 and `@vitejs/plugin-vue` 6.0.9 from the repository's
install, with TypeScript 7.0.2 as the `typescript` that `vue` resolves and 6.0.2 from
`tests/toolchains/vue`. The scripts were scratch work and are not committed.

- **`compileScript` over an output tree.** A script parsed `Button.vue`,
  `<script setup lang="ts">` with one import and `defineProps<X>()`, and called
  `compileScript(descriptor, { id, fs })`. The `fs` served `base.ts`, `types.ts`, `index.ts` and
  `Field.vue` from memory and every other path from the disk. These resolved, each printing its
  runtime props and the files it read (`deps`):
  - `ButtonProps extends BaseProps, Labelled` from `./types.ts`, `./types` and `./types.js`, with
    `BaseProps` and `Labelled` in `./base.ts`:
    `{ size: { type: String, required: false }, id: { type: String, required: true }, disabled: { type: Boolean, required: false }, tone: { type: String, required: false }, label: { type: String, required: true } }`,
    deps `types.ts, base.ts`.
  - An `extends` chain two files deep, `Pick`, `Omit`, `Pick<…> & Omit<…>`, `Partial`,
    `Required<Pick<…>>`, `Readonly`, an intersection, and `Omit<ButtonProps, "size">` written in
    the component. `Omit<ButtonProps, "tone" | "disabled">` gave `size`, `id` and `label`.
  - `export type { ButtonProps } from "./types.ts"` and `export * from "./base.ts"` in an
    `index.ts`: deps `index.ts, base.ts, types.ts`.
  - `FieldProps` exported from `<script setup>` in `./Field.vue`: deps `Field.vue`.
  - `ListProps<T>` under `generic="T"`: `{ items: { type: Array, required: true }, selected: { type: null, required: false } }`.
  - A mapped type over a literal union, a `keyof` member, an indexed-access member and
    template-literal keys. The syntactic oracle refuses these (UF6002), so they reach Vue only
    through the tsgo adapter.
- **What failed:**
  - `import type * as T from "./types.ts"` with `defineProps<T.ButtonProps>()`:
    `Unresolvable type reference or unsupported built-in utility type`.
  - A conditional type, and one with `infer`: `Unresolvable type: TSConditionalType`.
  - `import type { SubscriptionLike } from "rxjs"`, without `registerTS`:
    `Failed to resolve import source "rxjs". TypeScript is required as a peer dep for vue in order to support resolving types from module imports.`
    With `registerTS` loading 7.0.2: `ts2.findConfigFile is not a function`. With 6.0.2 it
    resolved: `{ unsubscribe: { type: Function, required: true }, closed: { type: Boolean, required: true } }`.
    `require("typescript")` from `vue` gives `7.0.2`, and its only keys are `version` and
    `versionMajorMinor`.
- **plugin-vue in a Vite build.** `vue/compiler-sfc` calls `registerTS(() => require("typescript"))`
  when it loads, and plugin-vue passes `compileScript` only its own `script` options. A
  `vite build` of a `Button.vue` on disk that imports `ButtonProps` from `./types.ts` failed with
  `[@vue/compiler-sfc] No fs option provided to compileScript in non-Node environment. File system access is required for resolving imported types.`
  With `vue({ script: { fs } })` over Node's `fs`, it built (`props: { label: {}, id: {} }`). An
  import from `rxjs` failed both ways, with the same two messages as above.
