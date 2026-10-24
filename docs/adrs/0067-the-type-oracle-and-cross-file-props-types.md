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
- Vue's L3 passes an `fs` over the output tree to `compileScript`, as `@vitejs/plugin-vue` does.
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

**Open:**

- Which constructs Vue's `compileScript` resolves through an `fs`, and whether package types
  resolve without TypeScript's classic API, absent from 7.0. L35's spike settles both and adds its
  section here.
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
