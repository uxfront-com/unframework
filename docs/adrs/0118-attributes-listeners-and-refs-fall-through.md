# ADR-0118: Attributes, listeners and refs fall through to a component's root

- **Status:** Accepted, amended by ADR-0122
- **Date:** 2026-11-21
- **Plan:** §4.2 (Options, Expose), §4.3 (Composition), §5.6, §6 (fallthrough attributes), §9 M3;
  P2, P3, P4, P6, P7; R5; ADR-0010, ADR-0022, ADR-0033, ADR-0034, ADR-0039, ADR-0053, ADR-0054,
  ADR-0055, ADR-0056, ADR-0063; amends ADR-0034 (a rest in the props pattern), ADR-0054 (class
  and style only), ADR-0055 (the `fallthrough` and `expose` cells, UF2001, UF3035, UF3036, UF3045,
  UF3046), ADR-0056 (Angular's fallthrough) and ADR-0022 (Vue's L4 options)

## Context

ADR-0054 let only `class` and `style` fall through to a component's root. It listed "every
attribute falls through" as a rejected alternative, because no target then needed it and Angular
has no attribute spread. Every other undeclared attribute was UF3035, a native listener UF3036,
and a ref on a component that exposes nothing UF3046. A rest in the props pattern was UF2001.

A design system needs more. The Open Components standard requires a Button to take a consumer's
`id`, `aria-*`, `data-*` and native attributes on its root element (`button/root-element`,
Must). Inkline's Button works around the gap with props such as `ariaPressed`, and it cannot pass
anything else. Plan §6's row for fallthrough attributes already describes the surface: `...rest`
in the source, and each target's native spread, `splitProps`, host or helper directive.

## Decision

Vue's rule, for components with one root:

- **Attributes (D1).** A component that keeps `inheritAttrs` takes every attribute its consumer
  passes that it does not declare. "Declares" means a prop, a model, a slot or an event from
  `defineEmits`. The attribute lands on the root element, or passes on to the root component,
  which places it by the same rule. The parent checks it as an attribute of that element, the
  **fallthrough element**, so the element rules hold (canonical names, enumerated values, ARIA).
  A name that is no attribute of it stays UF3035. The consumer's value wins over the root's own.
  `class` and `style` keep ADR-0054's merge. `key` is no attribute, and `ref` follows D4. A
  name a root component declares, a prop, a model or an event, is UF1002 ("not yet") where it
  would fall through to it: Vue and React give it to that declaration, and the targets that
  type the rest as the element's attributes would reject or mistype it, so no target is
  checked to deliver it alike yet.
- **Listeners (D2).** An `onX` of a DOM event the component does not declare is a native
  listener on the fallthrough element, lowered as that element's own listener would be. An `onX`
  that is neither is UF3036. Where the root has its own listener of the same event, both run, the
  root's own first, as Vue merges them. A listener option on a fallthrough listener is UF1002.
  It needs `interactivity`, so Astro reports it (UF4001, info) and drops it.
- **Rest (D3).** `function Field({ label, ...rest }: FieldProps)` is the one canonical form. It
  is accepted only with `defineOptions({ inheritAttrs: false })`. Otherwise it is UF2001, whose
  safe fix adds the call. `rest` holds exactly what D1 would put on the root, its `class` and
  `style` included, and never a declared prop or a scope attribute (`data-uf-*` stays on the
  root, ADR-0063). Its one use is a whole spread on one element outside any list, `<input
{...rest} />`, which becomes the fallthrough element. Any other use is UF2001: a member read, a
  second spread, a spread in a list or a slot's fill, or on a component or `<component is>`.
- **Refs (D4).** A `ref` on a component that does not call `defineExpose` holds its root element,
  through a chain of root components, as Vue's `$el` does, whatever `inheritAttrs` says. Its type
  is the element's DOM interface by name, `useTemplateRef<HTMLButtonElement>()`. A ref on a
  component that calls `defineExpose` holds only what it exposes, as ADR-0055 says. It never holds
  the element too: one ref has one value of one type, and merging functions onto an element
  collides with its members (`focus`). A component that wants both exposes a function that acts
  on its element. UF3046 reports a ref whose type is not the root's interface, and one on a
  component whose root is not one element. It also reports a ref through a root component that
  exposes, which would hold that component's functions on most targets and the root element on
  Vue: a documented limit.
- **The API (D5).** `ComponentApi` gains `fallthroughTag` and `refTag`, with
  `fallthroughNamespace`, `rootDeclarations` and `exposingRoot` for the checks above. The
  resolver reads a child with its own children's APIs, each once per compile, so a root
  component's tags reach a parent in another file.
- **IR.** A component element takes `Static`, `Bound` and `Event` attributes, which fall through.
  An element takes `Rest`, `{...rest}`. No new diagnostic code and no new capability: the
  `fallthrough` and `expose` cells widen.

Each target's cell, with what the corpus showed:

| Target  | `fallthrough`                                                                                        | `expose` (a component that exposes nothing)                                     |
| ------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| React   | Native: the props' rest spread last on the root, `mergeRefs` and `restAttributes` inline             | Native: React 19's `ref` prop on the root                                       |
| Vue     | Native: `$attrs`, and `restAttrs($attrs)` with `scopeAttrs($attrs)` on the root for `...rest`        | Native: the instance's `$el`, read in a `computed`                              |
| Svelte  | Emulated by `mergeStyle` for the style merge, attributes and rest native through `$props()`'s rest   | Native: a `$bindable` `ref` prop, bound with `bind:ref`                         |
| Angular | Emulated: the `ufAttributes` and `ufListeners` inputs, applied by the inline `Fallthrough` directive | Emulated: the child's `ufElement` member, read through the parent's `viewChild` |
| Solid   | Native: `splitProps`, the rest spread last on the root (Solid 2: `omit`)                             | Native: Solid's `ref` prop, spread on the root                                  |
| Qwik    | Native: the props' rest spread last on the root                                                      | Emulated `exposeRef` as before, and Qwik's element `ref` signal on the root     |
| Astro   | Native: the rest of `Astro.props` on the root, listeners UF4001 through `interactivity`              | UF4001 (info), as before                                                        |

Angular (D8, R5). Angular has no attribute spread, and a host that carries an attribute is not
unwrapped (ADR-0010). A component that takes fallthrough declares two inputs, `ufAttributes`, a
record of attributes, and `ufListeners`, a record of handlers by event. Its fallthrough element
carries an inline attribute directive, `Fallthrough`, which sets and removes the attributes
through `Renderer2` on the server and the client, and adds the listeners with `Renderer2.listen`
in the browser. Where that element binds an attribute of its own that the record holds, it binds
the consumer's value, so the consumer's still wins after its own changes. The parent binds both
inputs on the `uf-*` host, which keeps no attribute. A ref reads the child's `ufElement`, a
`viewChild` of its root, which a root component forwards. Moving the host's attributes as
`[ufScope]` does was rejected: it reads them once, a non-bubbling event never reaches the host,
and the host keeps them in the server render. `ufAttributes`, `ufListeners` and `ufElement`
join UF2003's reserved names. A hand-written Angular consumer that writes `id="x"` on
`<uf-button>` puts it on the host, and passes `[ufAttributes]` instead.

Vue's L4 configuration sets `fallthroughAttributes`, vue-tsc's own option, so a consumer's `id`
or `@click` on a child type-checks against the child's root element under `strictTemplates`.

```tsx
// Field.uf.tsx
export default function Field({ label, ...rest }: { label: string }) {
  defineOptions({ inheritAttrs: false });
  return (
    <label class="field">
      {label} <input {...rest} />
    </label>
  );
}

// A parent
<Field label="Email" id="email" placeholder="you@example.com" onFocus={track} />;
```

## Consequences

**Positive:**

- A component can take a consumer's attributes, listeners and ref the way Vue's do, which Open
  Components' Button requires.
- A parent's checks still catch a misspelt prop and an event that is no DOM event, since what
  falls through is checked against a known element.

**Negative:**

- Every component that takes fallthrough has a larger output: a wider props type on every typed
  target, the rest spread, and on Angular two inputs, a directive and a member. The L15 budgets
  move.
- React's `<Name>Attributes` becomes a type alias of the root element's props, or of a root
  component's own (`ComponentPropsWithRef<typeof Base>`). Angular reserves three more names, so
  a source that uses one as a prop stops compiling (UF2003).
- A consumer's listener whose React prop does not behave like the DOM event on the child's root
  is UF1002 on React (a text field's `change`, `focusin`, `focusout`, `select`, `beforeinput`).

**Open:**

- A conditional root and a `<component is>` root take no fallthrough yet (UF3045). Inkline's
  button-as-link work decides whether they should, and whichever of the two changes lands second
  makes fallthrough reach it.

## Alternatives considered

- **Class and style only (ADR-0054).** It fails the standard's Must, and forces a prop per
  attribute, which no design system can list in full.
- **A rest object any code may read.** Each target holds the rest its own way (`$attrs`,
  `splitProps`, an Angular record), so reading a member of it would mean a different thing per
  target (P4). One whole spread on one element is the use every target writes natively.
- **A ref that holds the element and the exposed functions.** No target merges the two, and a
  function named like an element member would hide it.
- **Angular: move the host's attributes onto the root.** See the Angular section: it loses bound
  updates and non-bubbling events, and leaves the host wrapped in the server render.
