# ADR-0119: A `<component is>` root takes fallthrough, and each tag its own attributes

- **Status:** Accepted
- **Date:** 2026-11-21
- **Plan:** §4.3 (Composition), §4.6, §5.3, §6, §9 M3; P2, P3, P6, P7; ADR-0032, ADR-0054,
  ADR-0055, ADR-0056, ADR-0063; amends ADR-0054 (a `<component is>` root takes neither `class` nor
  `style`, and its attributes must be valid on every candidate) and ADR-0055 (`ComponentApi.root`,
  and the invariants of a `Dynamic` node)

## Context

A design system's button renders a link when it has an `href` and a button otherwise, with one
styled root. Open Components' reference Button is
`<component :is="href ? 'a' : 'button'">`. Unframework could not compile that component in a
form a parent can style, for two reasons that ADR-0054 recorded as decisions:

- **A `<component is>` root takes neither `class` nor `style`.** `ComponentApi.root` reads it as
  `"other"`, so a parent that passes `class` to it gets UF3045, as for a fragment, a conditional
  or a list.
- **Its attributes must be valid on every candidate.** `href` on `is={href ? "a" : "button"}` is
  UF3006 for `<button>`, and `disabled` is UF3006 for `<a>`.

Neither holds up against what the targets do. A `<component is>` over tags renders exactly one
element from a set the compiler knows, as a one-element root does, and every target already
compiles it: React, Qwik and Astro through `const Tag = …`, Vue through `<component :is>`, Svelte
through `<svelte:element this>`, Solid through `<Dynamic>`, and Angular through an `@switch`. Every
target but Angular leaves out an attribute whose value is `undefined`, and Angular writes each tag
in a case of its own. So both rules can be lifted without a new capability.

## Decision

**A dynamic root.** A component's root is **dynamic** when its returned JSX is exactly one
`<component is>` whose candidates are all HTML tags, in the place a one-element root sits. Inside
a fragment, a conditional, a list, a `<Teleport>` or a `<Transition>`, and over components, it is
still `"other"`.

- `ComponentApi.root` takes a fourth value, `"dynamic"`, and `ComponentApi.rootTags` lists the
  tags in source order. `rootTag` stays an element root's alone, so no reader of it changes.
- The API reads the tags from the forms that need no render context: a string literal, a template
  literal with no expressions, a conditional whose leaves are such literals, and a prop, written
  `tag` or `props.tag`, whose type as written, or through an alias, is a union of string
  literals. These are the forms the lowering reads over tags, apart from a setup value typed as a
  union, so the API and the lowering agree.
- Where the API can't list the tags, as for `is={tag.value}` over a `ref`, the root stays
  `"other"` and `ComponentApi.rootUnlisted` is set. A parent's UF3045 then says why, and its help
  names the forms above.

**Fallthrough onto it.** A parent's `class` and `style` merge into whichever tag renders, by the
rules of a one-element root (ADR-0054): the union of the class tokens, the consumer's declaration
wins for a property both set, and a nullish one removes it. A component whose root is a component
with a dynamic root passes them on, since each compile judges its own child. `inheritAttrs: false`
keeps its rule. The parent lowers them as the first tag's attributes: `class` and `style` are
global, so the tag can't change the result.

**The parent places every tag.** Where a component's root must sit inside a given parent, the
parent's compile checks each tag of a dynamic root, as `lowerTags` does for its own placement: `<li>`
or `<div>` inside a `<p>` is UF3003 for each tag that can't sit there.

**Per-candidate attributes.** For any `<component is>` over tags, at the root or not:

- An attribute that at least one tag takes by name is accepted, and it renders only when a tag that
  takes it renders. "Takes by name" is the one check `nameProblem` makes per tag ("`x` is not an
  attribute of <tag>"). Every other check still runs on each tag that takes the attribute, and an
  ARIA name, a `data-*` name, a listener, `class`, `style`, the template ref and the scope
  attributes go on every tag, as before.
- An attribute no tag takes is still UF3006, reported once, with a message that names every tag:
  "`colspan` is not an attribute of <a> or <button>."
- `DynamicNode.only` lists, by name, each `Static` or `Bound` attribute that only some tags take,
  with those tags. An invariant checks that each entry names one such attribute of the node once,
  and lists some of the node's tags, never none and never all. An attribute every tag takes has no
  entry, so the IR and the output of every existing case stay the same.
- The node keeps every attribute, whichever tag comes first in `is`. An attribute the first tag
  doesn't take is lowered as the first later tag that takes it.

**Each target.** No capability cell changes: `fallthrough` and `dynamic-component` keep their
values.

| Target  | `class` and `style` on the dynamic root                                   | An attribute only some tags take                                        |
| ------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| React   | `className` and `style` props, merged into `<Tag>` as into an element     | `href={Tag === "a" ? href : undefined}`                                 |
| Vue     | Native: `$attrs` falls through to `<component :is>`                       | `:href="(href ? 'a' : 'button') === 'a' ? href : undefined"`            |
| Svelte  | `class` and `style` props, merged into `<svelte:element>` as into a root  | `href={(href ? "a" : "button") === "a" ? href : undefined}`             |
| Solid   | `props.class` and `props.style`, merged into `<Dynamic>` as into a root   | `href={(props.href ? "a" : "button") === "a" ? props.href : undefined}` |
| Angular | The `class` and `style` inputs, merged into the element of each `@case`   | Each `@case` writes only the attributes its tag takes                   |
| Qwik    | `class` and `style` props, merged into `<Tag>`, or into each tag's branch | The guard on `<Tag>`, or each branch writes only its tag's              |
| Astro   | `class` and `style` props, merged into `<Tag>` as into an element         | `href={Tag === "a" ? href : undefined}`                                 |

- Solid writes the root's leftover `class` and `style` on its scope-root path, which holds for a
  dynamic root because `scopeRoots` counts a root `Dynamic` (`codegen/src/scope.ts`). Narrowing
  `scopeRoots` would drop them.
- Qwik writes a `<component is>` with listeners as one element per tag (ADR-0054). The fallthrough
  merges into each branch, and each branch writes only the attributes its tag takes.
- Every guarded form type-checks with no cast on the typed targets (L3 and L4).
- React planned no listener on a `<component is>` over tags, so a listener there failed to emit
  (UF9001). Its listeners are now planned on the node, and a listener is synthetic only where every
  tag keeps React's synthetic event for it.

For example, this child and parent:

```tsx
export default function Base({ href, disabled }: { href?: string; disabled?: boolean }) {
  return (
    <component is={href ? "a" : "button"} href={href} disabled={disabled} class="base">
      Docs
    </component>
  );
}

export default function Page() {
  return <Base href="#docs" disabled={true} class="wide" />;
}
```

render `<a href="#docs" class="base wide">Docs</a>` on every target, with no `disabled`.

## Consequences

**Positive:**

- A component can render a link or a button with one styled root, as Open Components' Button does,
  and a parent styles it as it styles any element root. Inkline's Button can take an `href`.
- An attribute that only some tags take no longer rules a tag out of `is`.
- The corpus case `fallthrough/dynamic-root` pins both rules on every live layer, through a
  component root, in a list row and as the tag changes.

**Negative:**

- The guard repeats `is` on Vue, Svelte and Solid, which have no `const` for the tag, so `is` is
  evaluated once per guarded attribute. It is a pure expression of the render's values.
- A dynamic root whose `is` reads a setup value can't take fallthrough, since the API reads
  declarations, not the setup. Its UF3045 says so.
- `ComponentApi.root` has a new value, so code that switches on every value of the exported union
  must handle it.

**Open:**

- The `contextual-root` capability counts element roots only, so Angular's note on a root that
  must sit inside a given parent doesn't cover a dynamic root yet. That gap is older than this
  record.
- Attribute, listener and ref fallthrough (a later record) must reach a dynamic root too: an
  attribute by this record's per-candidate rule, and a ref typed as the union of the tags'
  elements.

## Alternatives considered

- **A conditional root, `{href ? <a /> : <button />}`.** Each branch is an element, so the merge
  would need a rule for each branch, and every target writes a conditional root its own way.
  `<component is>` is already one element at run time, so it needs only the API's new value.
- **Pass the classes as a prop to a headless child.** A Styleframe recipe from a pass-through
  module can only be called in a `class` attribute (UF5006), and a component without an element
  root loses its `className` and `style` props on six targets, which breaks its consumers.
- **Keep "valid on every candidate" and split the component in two.** A link and a button
  component each need the same styled root, and a parent that chooses between them is a
  conditional root again.
