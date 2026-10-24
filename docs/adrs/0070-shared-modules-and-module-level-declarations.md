# ADR-0070: Shared modules and module-level declarations

- **Status:** Proposed
- **Date:** 2026-10-24
- **Plan:** §4.1, §4.2, §5.10, §9 M5; P2, P6, P7, P8; ADR-0005, ADR-0045, ADR-0053, ADR-0054,
  ADR-0064, ADR-0069; amends ADR-0045

## Context

Plan §4.1 and ADR-0005 copy plain `*.ts` modules into each output tree unchanged: they are
framework-agnostic, so they need no compiling. Today a component can't use one. ADR-0045 leaves
module-level constants and imports of `.ts` modules to M5, and the analyser rejects a read of an
imported or a module-level value as UF1002 ("lands in M5"). Design systems keep sizes, variant tables and small
pure helpers in shared files, and a component often keeps a lookup table above its function.

Three forces shape the rule:

- **No runtime (P7).** A copied `.ts` module must stay framework-agnostic, or the output tree
  would hold a module that only one framework can load.
- **A key is not a value.** ADR-0054 keeps injection keys in the providing `.uf.tsx` module,
  because a key's runtime form differs per target.
- **Each target reads a module binding its own way.** Angular's template sees only class members,
  and Qwik's `$` scopes may capture only what the optimizer can serialise or import.

## Decision

**What a component may read:**

- Values and types imported from relative `.ts` modules.
- Its own module's top-level `const` declarations.
- Module-level values are read-only: plain functions, literals and frozen objects.

The analyser classifies an imported binding as `import` and a module-level one as `moduleConst`,
and records the imports in `UfModule.moduleImports`.

**What a shared module may import:** other relative `.ts` modules, and packages. Never a framework
or `unframework`, directly or through another `.ts`: that is UF1204
(`framework-in-shared-module`, error), and the component is withheld, so no target runs.

**How each target reads a module binding**, in its composables lane (ADR-0069):

- Each output imports it from the copied module, as the source does.
- Angular also exposes it to its template through a `protected readonly` member.
- Qwik captures it as a module-level import, which a `$` scope may read.

**Output:**

- `compile()` emits each `.ts` module a component reaches unchanged, beside the outputs, and lists
  it in `CompileResult.dependencies`.
- Several sources of one case may emit the same `.ts`. The harness accepts a path that two sources
  emit only when the contents are identical. The project graph then emits each `.ts` once, from its
  own node (ADR-0071).

**Keys stay where they are.** An injection key lives in the `.uf.tsx` module that provides it
(ADR-0054). UF2032's description, which names a key in a `.ts` module, is reworded to say so. Keys
in `.uf.ts` modules are a later issue.

**The cases**, landed with the composable cases (ADR-0069): `modules/shared-constants`,
`modules/shared-helpers`, `modules/module-constants` and `modules/nested-modules`, each green on
all seven targets with its `.ts` modules byte-identical in every output tree, and
`diagnostics/framework-in-shared-module`.

**What it amends.** ADR-0045 accepts imports of relative `.ts` modules and the module's top-level
`const` declarations, which it deferred to M5.

## Consequences

**Positive:**

- Constants, variant tables and pure helpers are written once and shared by every component and
  every target, with no compiling.
- The output tree stays self-contained, and each copied module is the author's own file.

**Negative:**

- A shared module can't use a framework, so logic that needs reactivity has to be a composable.
- Module-level values are read-only, so module state shared between instances has no form.
- Angular's members and Qwik's capture are two more per-target rules to keep in step.

## Alternatives considered

- **Compile `.ts` modules like composables.** A plain module has nothing to lower, and compiling it
  would turn the author's file into seven files that differ for no reason (§4.1).
- **Pass `.ts` imports through as written,** as ADR-0064 does for a styling engine's `virtual:`
  modules. A pass-through import is neither relative nor absolute, and its module comes from a Vite
  plugin. A relative `.ts` must sit in the output tree, or the outputs would not check or load on
  their own.
