# ADR-0068: Generic components and exported public types

- **Status:** Proposed
- **Date:** 2026-10-24
- **Plan:** §4.2, §5.6 (layer 4), §6, §7.2 (L4), §9 M5; G2, P2, P4, P6; ADR-0033, ADR-0034,
  ADR-0059, ADR-0067; amends ADR-0034 and ADR-0059

## Context

ADR-0034 rejects a generic component as UF1002. Design systems need them: a list, a select or a
table typed by its items, `function List<T>(props: ListProps<T>)` (plan §9 M5). Each framework has
its own generic form, and not every one can carry `T` everywhere a consumer needs it:

- Angular's slot directives can't infer `T` for a scoped slot's context, since ngtsc infers a
  component's type parameter from its inputs alone.
- Qwik's `component$` returns a non-generic component, so a generic signature needs a cast.
- Whether `astro check` types `interface Props<T>` for a consumer is not yet known.

Consumers also need the types a component's module exports. Every target already exports a type
that a component uses (`cases/props/null-and-absent`), as `TypeDeclaration.exported` records. Two
kinds are missing on every target: an exported type that no component uses, which is UF1002 today,
and a type re-export. ADR-0059's consumer fixtures can also name only a prop, an event, a model or
a slot.

## Decision

**The source.** A component declares type parameters on its function, and its props type takes
them: `function List<T>(props: ListProps<T>)`. The IR records them in `UfComponent.typeParameters`,
and `ComponentApi.typeParameters` tells a parent that a child is generic. Both are omitted when
empty. Shapes keep `T` as a type-parameter node (ADR-0067).

- Explicit JSX type arguments (`<List<string> … />`), and a generic child as a `<component is>`
  candidate, are UF6006 (`generic-instantiation`, error): the consumer's props infer `T`.

**Per target:**

| Target       | `function List<T>(props: ListProps<T>)`                                    | `generic-components`                    | `generic-slot-props`       |
| ------------ | -------------------------------------------------------------------------- | --------------------------------------- | -------------------------- |
| React, Solid | a generic function component                                               | native                                  | native                     |
| Vue          | `<script setup lang="ts" generic="T">`                                     | native                                  | native                     |
| Svelte       | `<script lang="ts" generics="T">`, with `Snippet<[T]>`                     | native                                  | native                     |
| Angular      | a generic component class, whose `T` ngtsc infers from the inputs          | native                                  | unsupported (UF4004, info) |
| Qwik         | `component$`, with Qwik's documented type-only cast to a generic signature | native: the cast is no helper           | native                     |
| Astro        | `interface Props<T>`                                                       | native, if M5's Astro spike confirms it | native                     |

- **Angular's gap.** A scoped slot's context takes `T`'s constraint, because slot directives can't
  infer `T`. UF4004 (`generic-slot-props`) says so at the slot.
- **Astro's fallback.** If the spike fails, Astro's types lane sets `generic-components` to
  unsupported with UF4006 (`generic-props`, info), and `Props` takes `T`'s constraint. Nothing else
  changes a cell.
- **What requires them** (`requiredCapabilities`): `typeParameters` on a component requires
  `generic-components`, and a slot prop whose type names a type parameter requires
  `generic-slot-props`, read through `references` on the slot's props.

**Exported public types.** Every type a source module exports, each output exports under the same
name and with the same meaning: a `ButtonProps`, a type no component uses such as a `Tone`, and a
re-export, `export type { X } from "./types"`.

- Vue keeps exporting them from `<script setup>`, as today, so none of Vue's goldens move.
- Svelte exports them from `<script module>`, where today its instance script does, so Svelte's
  goldens that export a type move. Astro exports them from its frontmatter, and React, Solid, Qwik
  and Angular from the module, through codegen's shared helper (ADR-0067).
- A consumer reads a component's full props with its framework's own utility, such as
  `ComponentProps<typeof X>`, `PropsOf<typeof X>` or `InstanceType<typeof X>["$props"]`, which
  the docs page names. The existing `XEvents`, `XModels` and `XSlots` interfaces stay as they are.

**Consumer type tests** (amends ADR-0059):

- A directive gains the kind `type`: `// @uf-expect TS2322 Button.type:ButtonProps`.
- `CONSUMER_GAPS` gains a part for generic slot props, so Angular's gap switches off only that
  check, and its other slot directives stay checked.
- `generics/scoped-slot`'s consumer fixture misuses `T` through a scoped slot. It fails with
  TS2339, or TS2551 for a near-miss name, on every typed target but Angular.
- The `L4-consumer` canary widens exported `interface` and `type` declarations too, and is caught
  on a `type` directive, including one whose type lives in a `.ts` module.

**The cases**, added on Vue with its fixtures in Vue's types lane, each target's column turning
green in its own lane: `types/imported-interface`, `types/extends-chain`, `types/utility-types`,
`types/package-types`, `types/child-type-import`, `types/intersection-props`, `types/shared-type`,
`types/exported-types`, `generics/list`, `generics/select`, `generics/scoped-slot`,
`generics/constrained`, and `diagnostics/generic-slot-props`.

**What it amends.** ADR-0034 accepts a generic component and a generic props declaration. ADR-0059
gains the `type` kind and the generic-slot-props gap.

## Consequences

**Positive:**

- Typed lists, selects and tables work on every target, with `T` checked for their consumers.
- A design system's consumers import its public types by name, in every framework.
- Every gap is a declared cell with its code, so no target differs only in a test (P4).

**Negative:**

- Angular consumers of a generic scoped slot see the constraint, not `T`.
- Qwik's cast is a type-only assertion the checker trusts, so only L4's consumer fixtures catch a
  wrong one.
- Two new capabilities and their rows on the targets page, set once, in the change that adds M5's
  IR and capabilities.

**Open:**

- Whether generic `Props<T>` in an Astro component type-checks for a consumer under `astro check`.
  M5's Astro spike settles it and adds its section here. If it fails, this record names UF4006's
  fallback as built.

## Alternatives considered

- **Erase `T` to its constraint on every target.** It would make every target match Angular's gap,
  and drop the checking that typed lists exist for (G2).
- **Reject generic components on Angular.** Its generic class works, and only scoped slots lose
  `T`, so a capability cell for that part keeps the rest native.
- **An inline helper for Qwik's generic signature.** A helper would make the cell emulated and add
  code to the output. Qwik's documented cast is type-only and adds none.
- **Print exported types instead of re-exporting them.** Printed types drift from the author's
  names and docs (ADR-0067).
