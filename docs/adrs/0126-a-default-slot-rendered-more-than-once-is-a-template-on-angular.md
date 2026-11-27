# ADR-0126: On Angular, a default slot rendered more than once at a time is a template

- **Status:** Accepted
- **Date:** 2026-11-27
- **Plan:** §4.3 (Slots, Composition), §5 (the API), §6 (Angular), §9 M3; P1, P2, P4, P6, P7;
  ADR-0053, ADR-0054, ADR-0055, ADR-0100; amends ADR-0056 (the default slot without props is
  `<ng-content>`), ADR-0124 (D3) and ADR-0125 (D6)

## Context

ADR-0056 writes the default slot without props as `<ng-content>` on Angular. Projected nodes exist
once, so one `<ng-content>` shows a parent's content in one place only. ADR-0124 and ADR-0125 share
one `<ng-content>` between places that render one at a time. Places that render together still
render the slot in one place only on Angular, with no diagnostic (P2):

- **A list's rows**, like `{items.map((item) => <li key={item}>{slots.default?.()}</li>)}`, inside a
  `<component is>` or not.
- **Two places at once**, like a header and a footer, or two branches a `<Transition>` animates,
  since the leaving branch stays in the document while the entering one renders (ADR-0100).
- **A fill a child renders more than once at a time**, like a scoped fill of a child that renders
  its slot once per row.

The other six targets render the slot in each place. Angular's own answer is a template that each
place renders, which Unframework already writes for every slot but this one (ADR-0056).

## Decision

**D1. The API says whether a component repeats a slot.** `ApiSlot` and `SlotDeclaration` take
`repeated: true` when the component may render the slot more than once at a time:

- an outlet under a list (`.map`),
- two outlets of the slot that aren't in different branches of one conditional, or are in branches
  a `<Transition>` animates, or
- an outlet in a fill, named, scoped or default, of a child's slot that is itself `repeated`, or of a
  child whose API can't be read. A slot forwarded to such a slot counts as one.

A scoped fill doesn't make an outlet `repeated` by itself: a child that renders its slot once
renders the fill once. A `<component is>` renders one case at a time, and a teleport, a transition
around one element and another slot's fallback render their content once. The field is absent
otherwise.

**D2. Computed once.** The analyser reads it from the returned JSX as written, with the rest of the
API (ADR-0055), once every component's API in the module and its imports is known, as it reads a
root component's tags (ADR-0118). The module's components render each other, so it reads them again
until no flag changes. The lowering copies the API's answer onto the slot's declaration, so a parent
in another file and the component itself agree.

**D3. Angular writes a `repeated` default slot through a directive.** The default slot without
props that is `repeated` is a slot directive, as a scoped default slot is (ADR-0056):
`ng-template[uf<Component>Default]`, exported as `<Component>Default`, read with `contentChild` and
rendered in each place under `@if (this.defaultTemplate(); as template)`, with the fallback in its
`@else`. The template ends with its `<ng-content select="[uf<Component>Default]" />`, as for named
slots. Its context is empty, so a consumer's `let-` variable is an error.

**D4. A parent fills it with a template.** A parent that fills the default slot of a child whose
`ApiSlot` is `repeated` writes `<ng-template uf<Child>Default>` and imports the directive.

**D5. ADR-0125's hoist reads the flag.** A default slot that isn't `repeated` keeps `<ng-content>`.
Where Angular would print more than one, its places render one at a time, and ADR-0124 and ADR-0125
share one between them. Their own checks for lists, scoped fills and simultaneous places go, so the
two rules can't drift.

A default outlet in a scoped fill of a child that renders the fill once joins
the hoist, and declares its fallback in place where it reads the fill's `let-` names.

For example, from the corpus case `slots/repeated-default`, the source

<!-- prettier-ignore -->
```tsx
<ul class="row-list" aria-label={label}>
  {items.map((item) => (
    <li key={item}>
      {item} {slots.default?.()}
    </li>
  ))}
</ul>
```

compiles on Angular to:

<!-- prettier-ignore -->
```html
@for (item of items; track item) {
  <li>{{ item }}&ngsp;@if (this.defaultTemplate(); as template) {<ng-container
    [ngTemplateOutlet]="template"
  />}</li>
}
…
<ng-content select="[ufRowListDefault]" />
```

and its parent fills it with:

<!-- prettier-ignore -->
```html
<uf-row-list [label]="'Produce'" [items]="['Apples', 'Pears', 'Plums']">
  <ng-template ufRowListDefault>
    <em>fresh</em>
  </ng-template>
</uf-row-list>
```

## Consequences

**Positive:**

- A default slot rendered more than once at a time renders the fill in each place on Angular, like
  the other six targets. `slots/repeated-default` pins it, with a hand-written Angular consumer that
  passes the template (L4).
- Every other component keeps its Angular API and its output. Other targets' outputs don't change.
- Another target can read the same flag, like Qwik, whose `<Slot />` projects once too.

**Negative:**

- The Angular API of a component with a `repeated` default slot changes: a hand-written consumer
  passes its content in `<ng-template uf<Component>Default>`, and children passed as they are render
  nothing, as for a scoped default slot.
- A refactor can change a component's Angular API: moving the default slot into a list, or beside a
  second outlet, makes it `repeated`.
- The IR snapshots of components that render a named or scoped slot in a list gain the flag.

## Alternatives considered

- **A diagnostic at the outlet's span.** It makes the difference loud, but leaves the forms unusable
  on Angular, where the other targets render them.
- **The flag decided in the Angular target.** A parent in another file reads only the child's API,
  so it couldn't tell whether to pass a template, and the two sides could disagree.
- **Every default slot as a template.** One form for every component, but it changes the Angular
  API of every component with a default slot, most of which render it once.
