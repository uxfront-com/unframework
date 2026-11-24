# ADR-0122: A `<component is>` root takes what every tag takes, and a ref holds the tag that renders

- **Status:** Accepted
- **Date:** 2026-11-24
- **Plan:** §4.3 (Composition), §4.6, §5.6, §6 (fallthrough attributes), §9 M3; P2, P4, P6, P7;
  ADR-0032, ADR-0054, ADR-0055; amends ADR-0118 (its Open item: fallthrough reaches a
  `<component is>` root) and ADR-0119 (its Open item: an attribute falls through by the
  per-candidate rule)

## Context

ADR-0118 let attributes, listeners and refs fall through to a component's root element or root
component. ADR-0119 let a root `<component is>` over tags take a consumer's `class` and `style`.
Each left the other's case open: whichever landed second was to make everything that falls through
reach a `<component is>` root. Until then, anything but `class` and `style` passed to such a root
was UF1002, and a ref on it was UF3046.

Inkline's Button is `<component is={href ? "a" : "button"}>`. The Open Components standard requires
a Button to take a consumer's `id`, `aria-*`, `data-*` attributes, listeners and ref on its root
element (`button/root-element`, Must), so the Button can't meet it while such a root takes nothing
else.

ADR-0119's Open item said an attribute should be accepted where a candidate takes it, and render
only on the tags that take it. That works for an attribute the child writes itself, which each
target guards by the tag (`Tag === "a" ? href : undefined`, or the `@case` of Angular). But what
falls through reaches the child whole, as one spread (`{...rest}`, `$attrs`, `ufAttributes`,
`splitProps`), and the child chooses its tag as it renders. Filtering that spread by the tag would
need a table of every tag's attributes inlined in each such output (P7), on seven targets, and on
Vue it would mean turning native `$attrs` off. Every name the Button needs (`id`, `aria-*`,
`data-*`, listeners and a ref) is taken by every tag, and a name only some tags take (`href`,
`disabled`) is a prop the Button already declares.

## Decision

**D1. What falls through: what every tag takes.** A consumer's undeclared attribute is accepted
where every tag of the root takes it by name, as `takesByName` reads a tag. It is then checked as
each tag's own attribute would be, with the root's own attributes and listeners
(`ComponentApi.fallthroughOwn`), and a problem any tag finds is reported once. So `id`, `title`,
`tabindex`, `aria-*` and `data-*` fall through, with `type` on `a` and `button`. Other names are
reported:

- A name that only some tags take is UF1002 ("not yet"), and the message names the tags that don't
  take it: "`disabled` falls through to Base's `<component is>` root only where every tag takes
  it, and <a> doesn't." Its help is to declare it as a prop and set it on the `<component is>`,
  which renders it only on the tags that take it (ADR-0119).
- A name no tag takes is UF3035, and the name it may mean is one every tag takes.

**D2. Listeners.** A consumer's DOM listener falls through as on an element root (ADR-0118), onto
whichever tag renders, after the root's own listener of the event. A listener option is UF1002. On
Astro it is dropped with UF4001 (info), at its own span, as on an element root.

**D3. Refs.** A ref on a component that exposes nothing and whose root is a `<component is>` over
tags holds the element that renders, and follows it as the tag changes. Its template ref is typed
as the union of the tags' DOM interfaces, each once, in any order:
`useTemplateRef<HTMLAnchorElement | HTMLButtonElement>()`. Tags that share an interface give it
once (`h2`, `h3`: `HTMLHeadingElement`). Any other type is UF3046, a single tag's interface and a
supertype such as `HTMLElement` included, as on an element root (ADR-0118), and its message names
the union to write.

**D4. Through a root component.** A component whose root component renders such a root, through a
chain of root components that keep `inheritAttrs` and expose nothing, takes D1 to D3 too.

**D5. The API.** `fallthroughTag` and `refTag` keep their meaning, one element, so no reader of them
types the rest as one tag:

- `rootTags` with `inheritAttrs` are the tags a parent checks what falls through against, where the
  component has no `fallthroughTag`. `fallthroughOwn` is the `<component is>`'s own attributes and
  listeners, and passes on through a root component with `rootTags`.
- `ComponentApi.refTags`, new, lists the tags a ref may hold, where the component exposes nothing.
  `fillRootComponents` passes it on as it does `refTag`. Every target reads it.

**D6. Each target.** No capability cell and no diagnostic code changes. Each output puts what falls
through on the tag that renders, typed as what every tag takes, with no cast:

| Target  | What falls through                                                                                                                                                                                                                                                       | The ref                                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React   | `{...attributes}` on `<Tag>`, typed `Omit<ComponentPropsWithoutRef<"a"> & ComponentPropsWithoutRef<"button">, … \| keyof DOMAttributes<E>> & Omit<DOMAttributes<E>, …>`, with `E` the union of the tags' elements, so a listener it chains takes one event type          | `ref?: Ref<E>`, which the root takes apart, `ref={rootRef}` from `useMemo(() => mergeRefs(ref), [ref])`: each tag types its `ref` for itself, and a callback of `E` fits both     |
| Vue     | Native `$attrs` on `<component :is>`. The props declare what every tag takes behind `/* @vue-ignore */`, `Omit<IntrinsicElementAttributes["a"] & IntrinsicElementAttributes["button"], …>`, since vue-tsc types a consumer's attributes from no tag of it                | The parent reads the child's `$el` through `toRef(() => child.value?.$el ?? null)`: `$el` changes with the tag, and Vue does not track it, so a `computed` would keep the old one |
| Svelte  | `{...attributes}` on `<svelte:element>`, typed `Omit<HTMLAnchorAttributes & HTMLButtonAttributes, … \| keyof DOMAttributes<E>> & Omit<DOMAttributes<E>, "children">`; the root's own listener that calls the consumer's is `(…) satisfies Props["onclick"]`              | A `$bindable` `ref` prop of `HTMLElementTagNameMap["a" \| "button"]`, which `<svelte:element>` binds, `bind:this={ref}`                                                           |
| Solid   | `splitProps`'s others on `<Dynamic>`, typed `Omit<ComponentProps<"a"> & ComponentProps<"button">, keyof JSX.DOMAttributes<E>> & JSX.DOMAttributes<E>` (`JSX.ElementAttributes` on Solid 2). A chained listener is `(…) satisfies typeof props.onClick`                   | Split out, and handed to whichever tag renders by a callback typed `E`, which calls the consumer's where it is a function                                                         |
| Angular | Each `@case`'s element binds `[ufFallthrough]` and takes `#ufElement`                                                                                                                                                                                                    | `ufElement`, a `viewChild` of `ElementRef<E>`, reads the `@case` that renders                                                                                                     |
| Qwik    | `{...attributes}` on each branch of the one-element-per-tag form, or on `<Tag>`, typed `Omit<PropsOf<"a"> & PropsOf<"button">, …>`. A parent types the parameters of a listener it passes one (`(_: PointerEvent, element: Element) => …`), since each tag types its own | In the rest, on each branch                                                                                                                                                       |
| Astro   | `{...attrs}` on `<Tag>`, `Props` extending `Omit<HTMLAttributes<"a"> & HTMLAttributes<"button">, …>`, its own attributes the consumer's where it passes the key                                                                                                          | Inert                                                                                                                                                                             |

An analyser probe of a later tag now copies the props' rest, so a `<component is>` root with
`inheritAttrs: false` and `{...rest}` on an inner element lowers the rest once, and takes what falls
through on that element (ADR-0118).

**D7. Diagnostics.** The UF1002 that said only `class` and `style` reach such a root is replaced by
D1's. UF3035, UF3045 and UF3046 describe it.

For example, this child and parent, from the corpus case `fallthrough/dynamic-root-passthrough`:

```tsx
export default function Base({ href, text }: { href?: string; text: string }) {
  return (
    <component is={href ? "a" : "button"} href={href} class="base" title="Base">
      {text}
    </component>
  );
}

export default function Page() {
  const direct = useTemplateRef<HTMLAnchorElement | HTMLButtonElement>();
  return <Base href="#direct" text="Direct" id="direct" title="Go" onClick={go} ref={direct} />;
}
```

render `<a href="#direct" class="base" title="Go" id="direct">Direct</a>`, whose click runs `go`,
and whose ref is the link, on every target.

## Consequences

**Positive:**

- Inkline's Button can take a consumer's `id`, `aria-*`, `data-*`, listeners and ref on its
  `<component is>` root, as `button/root-element` requires.
- The corpus case `fallthrough/dynamic-root-passthrough` pins D1 to D3 on every live layer,
  directly and through a root component, before and after the tag changes. The analyser's tests pin
  D1, D3 and the rest, and a compiler test pins Astro's UF4001 at the listener's span.

**Negative:**

- A name that only some tags take still can't fall through. The consumer gets UF1002, and the
  component must declare it.
- Every component with a `<component is>` root has a larger output: a wider props type, the rest's
  spread, and on Angular the directive and `ufElement`. `dynamic/prop-union` and
  `styles/child-root-branches` change their outputs, not their expectations.
- Qwik and Svelte type a listener on such a root as each tag's, which give a handler no one type. A
  hand-written Qwik consumer annotates its handler's parameters, as the compiler's own parents do.

**Open:**

- Letting a name that only some tags take fall through, rendered only on those tags, needs a filter
  of the spread by the tag that renders on each target. Nothing needs it yet.
- A `<component is>` candidate Angular binds nothing on (`{{` in an attribute, ADR-0037) still takes
  nothing that falls through, as an element root of that kind doesn't, and nothing reports it.

## Alternatives considered

- **Per candidate, as ADR-0119's Open item said.** It needs the spread filtered by the rendered tag
  on seven targets, an inline table of each tag's attributes (P7), and Vue's native `$attrs` turned
  off. D1 covers what the Button needs, and widening it later breaks no source, since the names it
  leaves out are UF1002 now.
- **A ref typed as `HTMLElement`.** It would accept a call no tag has, and differ from an element
  root's rule (ADR-0118).
- **Type a dynamic root's rest as its first tag's.** A listener would see the wrong element, and an
  attribute only that tag takes would type-check and never reach the other tag.
