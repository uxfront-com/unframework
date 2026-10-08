# ADR-0055: The composition contract: IR kinds, capabilities and codes

- **Status:** Proposed
- **Date:** 2026-10-08
- **Plan:** §5.3, §5.6 (layer 2), §5.7, §5.9, §7.7 (coverage gate), §9 M3; P2, P4, P5; ADR-0032,
  ADR-0033, ADR-0053, ADR-0054, ADR-0056; amends ADR-0032 (its invariants)

## Context

ADR-0053 and ADR-0054 decide what composition means and how each target writes it. Plan §9
builds a milestone in lanes that run in parallel: a core lane (the IR, the analyser), seven target
lanes and a harness lane. Here a contract change adds the IR kinds, the capabilities and the
codes; the core lowers into them; the target lanes emit them; and the layer-2 checks report
against them. Each of those surfaces is one file that two lanes cannot change at once (the IR's
`types.ts`, `CapabilityName`, `catalogue.ts`). So the contract is fixed here, before any code,
with every cell and every code number.

The rules it builds on: every node carries a span, and a field exists only when a consumer reads
it (§5.3, ADR-0032); every capability has a cell on every target, and an unsupported cell names
its UF4xxx code (ADR-0033); codes are allocated in order and never reused (§5.9). The next free
numbers are UF1202, UF2028 and UF3035.

## Decision

**The IR.** New and changed shapes, in `@unframework/ir` (`types.ts`, the builders, `walk`, the
invariants, `portability.ts` and the schema):

- **Module.**
  - `UfModule.imports?: ModuleImport[]`, absent when empty, as `emits` is: `{ specifier, file, api: ModuleApi, names: ImportedName[],
span }`. `file` is the resolved `.uf.tsx`, relative to the importer, with forward slashes.
    `ImportedName` is `{ kind: "Component" | "Key", imported, local, span }`.
  - `UfModule.keys?: InjectionKeyDeclaration[]`, absent when empty: `{ name, description, type: TypeText, span }`, each
    exported.
  - `ModuleApi` is what the resolver returns (ADR-0053): `{ file, components: ComponentApi[], keys:
KeyApi[] }`. `ComponentApi` is `{ name, export: "default" | "named" | "local", props, events,
models, slots, exposes, inheritAttrs, root, rootTag? }`: each prop, event, model and slot by
    name, with its optionality and its type as written (for layer 2's literal unions); `exposes` the
    exposed names; `root` is `"element"`, `"component"` or `"other"`, and `rootTag` the root
    element's tag. `KeyApi` is `{ name, description, type }`.
- **Component.** `UfComponent.slots?: Slots` (`{ binding, type, slots: SlotDeclaration[], span }`,
  each `{ name, optional, props?: TypeText, span }`), `UfComponent.exposes?: { functions:
BindingId[], span }` and `UfComponent.inheritAttrs?: false`.
- **Bindings.** `BindingKind` adds `model` (read and written as `x.value`, like `state`), `slots`,
  `slotScope` (a scoped fill's parameter), `context` (an injected value, read-only) and `component`
  (a component named in `<component is>`).
- **Setup items.** `Model { binding, name, type?, default?: Expression, required?: true, span }`,
  `Provide { key, value: Code, span }` and `Inject { binding, key, fallback?: Code, span }`, where
  `key` is the local name of a module key or an imported one. A `WriteReference` may write a
  `model` binding.
- **References.** `SlotReference { kind: "Slot", slot, span }`: `slots.title` as a condition.
- **Render nodes.** `RenderNode` adds:
  - `Component { component, attributes: ComponentAttribute[], fills: SlotFill[], span }`, where
    `component` is the local name of an imported component or of one of the module's own;
  - `SlotOutlet { slot, props?: Expression, fallback: RenderNode[], span }`;
  - `Dynamic { is: Expression, candidates: ({ kind: "Tag", tag } | { kind: "Component", component
})[], attributes: (Attribute | ComponentAttribute)[], children: RenderNode[], fills?: SlotFill[],
span }`. Tag candidates take element attributes and children; component candidates take
    component attributes and fills, each declared by every candidate (UF3044 otherwise).

  `ForNode.body` becomes `ElementNode | ComponentNode`.

- **A component's attributes.** `ComponentAttribute` is `Prop { name, value: Expression, span }`
  (a static value is a literal expression), `Listener { event, handler: Handler, span }`,
  `ModelBinding { model, value: Expression, span }`, and the existing `Class`, `Style` and `Ref`.
- **Fills.** `SlotFill { slot, parameter?: Parameter, children: RenderNode[], forward?: string,
span }`: the default slot's fill is the children; `forward` names the parent's own slot a fill
  passes on, with no children.
- **An element's `v-model`.** `Model { value: Expression, control: "text" | "number" | "textarea" |
"select" | "select-multiple" | "checkbox" | "checkbox-group" | "radio", trim?: true, lazy?: true,
number?: true, span }`, an `Attribute`.
- **Invariants** (ADR-0032) check that a `Component` names exactly one imported or local component,
  that each prop, listener, model and fill names a declaration of its `api`, that a `ModelBinding`
  or `Model` value is a `state` or `model` binding's `.value`, that a `context` binding is never
  written, and that a `Dynamic` node's candidates are all tags or all components.

**Capabilities.** `CapabilityName` adds these, in this order. A cell is `native`, `emulated` with
its inline helper, or `unsupported` with UF4001 and the severity shown. No new UF4xxx code is
needed: each unsupported cell reports UF4001 with its reason, as every cell does (ADR-0033).

| Capability              | What uses it                                                                     | React                 | Vue    | Svelte                | Solid                                | Angular                              | Qwik                                 | Astro                                         |
| ----------------------- | -------------------------------------------------------------------------------- | --------------------- | ------ | --------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------ | --------------------------------------------- |
| `component`             | a `Component` node                                                               | native                | native | native                | native                               | native                               | native                               | native                                        |
| `component-event`       | a `Listener` on a component; refines `interactivity`, behavioural                | native                | native | native                | native                               | native                               | native                               | UF4001 (info): inert                          |
| `default-slot`          | the default slot's outlet or fill                                                | native                | native | native                | native                               | native                               | native                               | native                                        |
| `named-slot`            | a named slot without props                                                       | native                | native | native                | native                               | emulated: `uf<Component><Slot>`      | emulated: `<slot>$`                  | native                                        |
| `scoped-slot`           | a slot with props                                                                | native                | native | native                | native                               | emulated: `uf<Component><Slot>`      | emulated: `<slot>$`                  | emulated: `<slot>` render prop                |
| `slot-fallback`         | an outlet with fallback content                                                  | native                | native | native                | native                               | native                               | native                               | native                                        |
| `default-slot-presence` | `slots.default` as a condition, or the default slot forwarded                    | native                | native | native                | native                               | UF4001 (error)                       | UF4001 (error)                       | native                                        |
| `slot-forwarding`       | a fill with `forward`                                                            | native                | native | native                | native                               | emulated: `uf<Component><Slot>`      | native                               | native                                        |
| `model`                 | `defineModel` (a `Model` item), and a `ModelBinding`                             | native                | native | native                | native                               | native                               | native                               | UF4001 (info): inert                          |
| `two-way-binding`       | an element's `Model`                                                             | native                | native | native                | native                               | native                               | native                               | UF4001 (info): inert                          |
| `model-array`           | a `Model` of a `checkbox-group` or a `select-multiple`                           | emulated: `toggle`    | native | native                | emulated: `toggle`, `selectedValues` | emulated: `toggle`, `selectedValues` | emulated: `toggle`, `selectedValues` | UF4001 (info): inert                          |
| `model-modifiers`       | a `Model` that is `trim`, `lazy` or `number`, or of a `number` control           | emulated: `modelText` | native | emulated: `modelText` | emulated: `modelText`                | emulated: `modelText`                | emulated: `modelText`                | UF4001 (info): inert                          |
| `fallthrough`           | a `class` or `style` on a component                                              | native                | native | native                | native                               | emulated: `fallthrough`              | native                               | native                                        |
| `contextual-root`       | a component whose root element lives only inside a given parent (ADR-0056)       | native                | native | native                | native                               | UF4001 (error)                       | native                               | native                                        |
| `expose`                | `defineExpose`, and a `Ref` on a component; refines `interactivity`, behavioural | native                | native | native                | native                               | native                               | emulated: `exposeRef`                | UF4001 (info): inert                          |
| `context`               | `Provide` and `Inject`                                                           | native                | native | native                | native                               | native                               | native                               | UF4001 (warning): `inject` gives its fallback |
| `reactive-context`      | a provided `state`, `derived` or `model` binding; refines `context`              | emulated: `refObject` | native | emulated: `refObject` | emulated: `refObject`                | emulated: `refObject`                | native                               | UF4001 (warning)                              |
| `dynamic-component`     | a `Dynamic` node                                                                 | native                | native | native                | native                               | emulated: `@switch`                  | native                               | native                                        |

- `CAPABILITY_PREREQUISITES` gains `component-event`, `expose`, `model`, `two-way-binding`,
  `model-array` and `model-modifiers` under `interactivity`, and `reactive-context` under
  `context`: an Astro module that binds a model reports `interactivity` once, as one with a
  listener does. `BEHAVIOURAL_CAPABILITIES` gains those six: a static render is the same without
  them.
- `capabilities.ts` maps `Component`, `SlotOutlet` and `Dynamic` in `NODE_CAPABILITIES`, the new
  attribute kinds in `ATTRIBUTE_CAPABILITIES`, and `Model`, `Provide` and `Inject` in
  `SETUP_ITEM_CAPABILITIES`; `requiredCapabilities` derives the rest at the span named above.
- `3.reference/1.targets.md` gets a row and a note per capability, with the contract change.

**Diagnostic codes.** In order, every one an error unless noted. Each is reported at the exact
span; the fixes are applied and recompiled by L1.

| Code   | Name                        | Band | Title                                                                         | Fix                                          |
| ------ | --------------------------- | ---- | ----------------------------------------------------------------------------- | -------------------------------------------- |
| UF1202 | `unresolved-import`         | UF1  | The imported component module cannot be resolved                              | none                                         |
| UF2028 | `invalid-model`             | UF2  | `defineModel` takes a name and static options                                 | safe: name a nameless model `"value"`        |
| UF2029 | `invalid-slots`             | UF2  | `defineSlots` declares optional slots, named apart from props and events      | none                                         |
| UF2030 | `invalid-expose`            | UF2  | `defineExpose` takes an object of the component's local functions             | none                                         |
| UF2031 | `invalid-options`           | UF2  | `defineOptions` takes a static `{ inheritAttrs: false }`                      | none                                         |
| UF2032 | `invalid-context`           | UF2  | `provide` and `inject` take an injection key, `inject` first                  | none                                         |
| UF2033 | `invalid-injection-key`     | UF2  | An injection key is an exported `InjectionKey` `Symbol` of a `.uf.tsx` module | none                                         |
| UF2034 | `context-write`             | UF2  | An injected value is read-only                                                | none                                         |
| UF3035 | `unknown-prop`              | UF3  | The component declares no such prop (layer 2)                                 | likely: the prop it meant                    |
| UF3036 | `unknown-event`             | UF3  | The component declares no such event (layer 2)                                | likely: the event it meant                   |
| UF3037 | `unknown-model`             | UF3  | The component declares no such model (layer 2)                                | likely: the model it meant                   |
| UF3038 | `unknown-slot`              | UF3  | The component declares no such slot (layer 2)                                 | likely: the slot it meant                    |
| UF3039 | `literal-outside-union`     | UF3  | The value is not one of the prop's literals (layer 2)                         | likely: the literal it meant                 |
| UF3040 | `invalid-slot-content`      | UF3  | A slot object holds arrow functions that return JSX                           | none                                         |
| UF3041 | `invalid-slot-use`          | UF3  | A slot is rendered, tested or forwarded, and nothing else                     | none                                         |
| UF3042 | `invalid-v-model`           | UF3  | `v-model` binds a ref's value to a form control or a named model              | safe: `v-model:<name>` for a one-model child |
| UF3043 | `component-listener-option` | UF3  | A component's event takes no listener option                                  | safe: drop the suffix                        |
| UF3044 | `open-dynamic-component`    | UF3  | `<component is>` chooses from a statically known set                          | none                                         |
| UF3045 | `dropped-fallthrough`       | UF3  | The component renders no `class` or `style` passed to it                      | none                                         |
| UF3046 | `invalid-component-ref`     | UF3  | A component ref holds what the component exposes                              | none                                         |
| UF3047 | `unknown-component`         | UF3  | The tag names no component in scope                                           | likely: the component it meant               |

- UF3035 to UF3039 are layer 2 of §5.6. Each says "did you mean `…`?" when a declared name is close.
  UF3038 covers a slot-object key the child does not declare and children given to a child with no
  default slot; UF3035 an attribute that is no prop, model, slot, `class`, `style`, `key` or `ref`.
- The next free codes were UF2028, UF3035 and UF4002. This record also takes UF1202, because an
  import that cannot be resolved belongs with UF1201's imports, and needs no UF4xxx code.
- A new macro or API that is not bound, or not called at the top level, reports UF2006 and UF2005
  as the M2 macros do. UF2028 to UF2033 cover only their arguments, options and keys, so no misuse
  gets two codes.
- Each code's catalogue entry and its section in `3.reference/2.diagnostics.md` come with the
  contract change, with an `EXEMPT_CODES` entry naming the lane whose case removes it.

## Consequences

**Positive:**

- Every lane of M3 works against one declared contract, and the shared files are each changed
  once, by the contract change.
- The coverage gate (§7.7) can require a case for every new kind, capability and code from the day
  they land, exempted by name until their lane.

**Negative:**

- The IR grows by three render nodes, four attribute kinds, three setup items, five binding kinds
  and one reference kind; `walk`, the invariants, `portability.ts` and every emitter's exhaustive
  switch change at once.
- A cell the lanes find wrong is a contract change: it needs an amendment here before the lane
  emits otherwise.

## Alternatives considered

- **A UF4xxx code per unsupported cell.** ADR-0033 reports every unsupported cell through UF4001
  with its reason; a code per cell would split one rule into many.
- **Slots as attributes of `Component`.** Fills hold render trees and a scoped parameter, which
  attributes do not; a separate list keeps `walk` simple.
- **Models as a field of `UfComponent`, as `emits` is.** A model is state the setup reads and
  writes in source order; as a setup item it keeps its place among the others (ADR-0045).
- **One capability for every slot form.** Angular, Qwik and Astro differ on named, scoped and
  default-presence slots separately; one cell could not say which.
