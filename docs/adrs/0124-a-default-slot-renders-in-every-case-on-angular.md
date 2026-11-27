# ADR-0124: On Angular, a default slot renders in every case of a `<component is>`

- **Status:** Accepted
- **Date:** 2026-11-27
- **Plan:** §4.3 (Slots, Composition), §6 (Angular), §9 M3; P1, P2, P4, P6, P7; ADR-0010,
  ADR-0053, ADR-0122; amends ADR-0054 (Angular's `<component is>` is one `@case` per candidate) and
  ADR-0056 (the default slot without props is `<ng-content>`)

## Context

ADR-0054 writes `<component is>` on Angular as an `@switch` with one `@case` per candidate, each
with the node's children, or its fills for components. ADR-0056 writes the default slot without
props as `<ng-content>`, with its fallback as its content. Together they give a `<ng-content>` in
each case for one outlet in the source:

```tsx
<component is={href ? "a" : "button"} href={href}>
	<span data-slot="label">{slots.default?.() ?? label}</span>
</component>
```

Angular assigns what a parent projects to one `<ng-content>` as it compiles the template, not as a
case renders. So only one case gets the parent's content. The other cases render the slot empty,
and they don't render the fallback either, since Angular counts the content as projected.

The other six targets render the slot in every case. `unframework check` reported nothing, so the
difference was silent (P2).

Inkline's Button hit it: its link rendered `<span data-slot="label">` with no text on Angular, so
the link had no accessible name.

## Decision

**D1. One `<ng-content>` before the `@switch`.** Where a component renders the default slot
without props in exactly one place, and that place is inside a `<component is>` of two or more
candidates, the template declares that `<ng-content>`, with its fallback, once, in an
`<ng-template>` right before the `@switch`. Each `@case` renders it with `ngTemplateOutlet`. The
component imports `NgTemplateOutlet`.

**D2. What it covers.** The outlet may sit in a tag candidate's children or in a component
candidate's default fill, under elements, components and other `<component is>`s. Where
`<component is>`s nest, the outermost one of two or more candidates takes the template. A fill
that forwards the default slot is out of its reach, since forwarding the default slot is UF4001 on
Angular (`default-slot-presence`, ADR-0056).

**D3. What it leaves as it is.** D1 doesn't apply where a list, a conditional, a teleport, a
transition, a scoped fill or another slot's fallback lies between the `<component is>` and the
outlet, since a template before the `@switch` can't see a name they declare, or narrow one as they
do. Nor does it apply where the component renders the default slot in two places, since Angular
then projects into one of them anyway. Those templates are as before.

**D4. Its name.** The template's reference is `defaultSlot`, claimed from the component's members,
so a prop or a setup binding of that name gives it another (`defaultSlot_1`).

**D5. No new cell or code.** The other six targets' outputs don't change. No capability cell and no
diagnostic code changes.

For example, the source above, from the corpus case `dynamic/default-slot`, compiles on Angular to:

<!-- prettier-ignore -->
```html
<ng-template #defaultSlot>
  <ng-content>{{ label }}</ng-content>
</ng-template>
@switch (href ? "a" : "button") {
  @case ("a") {
    <a [attr.href]="…" class="action">
      <span data-slot="label">
        <ng-container [ngTemplateOutlet]="defaultSlot" />
      </span>
    </a>
  } @case ("button") {
    <button class="action">
      <span data-slot="label">
        <ng-container [ngTemplateOutlet]="defaultSlot" />
      </span>
    </button>
  }
}
```

## Consequences

**Positive:**

- Inkline's link Button renders its label on Angular, so the link has an accessible name.
- A link and a button render the parent's content, or the fallback where the parent passes none,
  on every live layer. When the tag changes, Angular moves the projected content into the case that
  renders. The corpus case `dynamic/default-slot` pins this on all seven targets, and the Angular
  target's tests pin D2 to D4.

**Negative:**

- A component that renders the default slot in two places, like two branches of a conditional,
  still renders it once on Angular, with no diagnostic. D3's other forms do the same.
- The template has one more node, the `<ng-template>`, which renders an anchor comment.

**Open:**

- A diagnostic, or a form of D1 for two outlets with different fallbacks, for a default slot the
  component renders in two places.

## Alternatives considered

- **A `select` for each case.** `<ng-content select>` matches what the parent projects by its
  selector, and a parent's content has no attribute to tell the cases apart.
- **All the children in one `<ng-template>`.** ADR-0056's mapping table writes a `<component is>`
  over tags so, but the printer writes the children in each `@case`. Moving them all would change
  the output of every `<component is>` with children, where only the default slot needs a single
  place. D1 takes that table's approach for the one node that needs it.
- **A default slot as an `<ng-template>` directive, like a named one.** It would change what every
  consumer writes for the default slot on Angular, where ADR-0056 has it pass children.
- **One `<ng-content>` outside the `@switch`, with the element around it chosen by the case.** An
  element can't be opened in one block and closed in another in an Angular template.
