# ADR-0125: On Angular, places that render one at a time share the default slot

- **Status:** Accepted
- **Date:** 2026-11-27
- **Plan:** §4.3 (Slots, Composition), §6 (Angular), §9 M3; P1, P2, P4, P6, P7; ADR-0054, ADR-0056,
  ADR-0098, ADR-0100; amends ADR-0124 (a default slot renders in every case of a `<component is>`)

## Context

ADR-0124 declares the default slot without props once, in an `<ng-template>` before a
`<component is>`'s `@switch`, so every case renders the parent's content. Its D3 left two forms as
they were, which still render the slot in one place only on Angular, with no diagnostic (P2):

- **An outlet under a conditional, a teleport, a transition or another slot's fallback** inside
  the `<component is>`. D3 kept them because a template before the `@switch` can't see a name a
  block narrows, like the `label` that `{label ? <span>{slots.default?.() ?? label}</span> : null}`
  tests.
- **The default slot in two places**, like both branches of a conditional, with or without a
  `<component is>` around it. Each place is an `<ng-content>`, and Angular gives a parent's content
  to the last one only, as it compiles the template.

The other six targets render the slot in whichever place renders.

## Decision

**D1. Places that render one at a time share one `<ng-content>`.** D1 of ADR-0124 extends to the
outlets of a default slot without props that never render together: every two of them sit in
different branches of the conditional nearest to both. Where they do, and Angular would print more
than one `<ng-content>`, the template declares one, in an `<ng-template #defaultSlot>`, and each
place renders it with `ngTemplateOutlet`. Angular moves the projected nodes into the place that
renders.

**D2. What doesn't stop it.** ADR-0124's D2 still holds, and a teleport, a transition around one
element, a conditional around one outlet and another slot's fallback don't stop D1 either, since
each renders its content once (ADR-0098, ADR-0100).

**D3. Where the template goes.** Right before the outermost `<component is>` of two or more
candidates that holds every place, as in ADR-0124, or else before the conditional at which the
places part. A template declared there reads every name the places read from outside it.

**D4. Each place keeps its fallback where it is.** When every place has the same fallback, and no
conditional between the template and a place may narrow what the fallback reads, the fallback is
the `<ng-content>`'s own, as in ADR-0124, whose outputs don't change. Otherwise each place declares
its fallback in an `<ng-template>` of its own, where it sees the block's names as narrowed, and
passes it as the context, which the `<ng-content>` renders with `ngTemplateOutlet` when the parent
passes nothing. A place without a fallback passes none.

**D5. Names.** The template's reference, its `let-` variable and each place's fallback template are
claimed from the component's members, as ADR-0124's D4 does: `defaultSlot`, `fallback`,
`defaultSlotFallback`, `defaultSlotFallback_1` and so on.

**D6. What stays as it is.** Places that render together keep one `<ng-content>` each, so Angular
still renders the slot in one of them: an outlet under a list, an outlet in a scoped fill, two
outlets in one branch or beside each other, and two branches that a `<Transition>` animates, since
its leaving branch stays in the document while the entering one renders. ADR-0124's D3 narrows to
these.

For example, from the corpus case `dynamic/default-slot-branches`, the source

<!-- prettier-ignore -->
```tsx
<p class="greeting">
  {user ? <b>{slots.default?.() ?? user.name}</b> : <i>{slots.default?.() ?? "Guest"}</i>}
</p>
```

compiles on Angular to:

<!-- prettier-ignore -->
```html
<ng-template #defaultSlot let-fallback>
  <ng-content>
    <ng-container [ngTemplateOutlet]="fallback" />
  </ng-content>
</ng-template>
@if (user) {
  <b>
    <ng-template #defaultSlotFallback>{{ user.name }}</ng-template>
    <ng-container
      [ngTemplateOutlet]="defaultSlot"
      [ngTemplateOutletContext]="{ $implicit: defaultSlotFallback }"
    />
  </b>
} @else {
  <i>
    <ng-template #defaultSlotFallback_1>Guest</ng-template>
    <ng-container
      [ngTemplateOutlet]="defaultSlot"
      [ngTemplateOutletContext]="{ $implicit: defaultSlotFallback_1 }"
    />
  </i>
}
```

## Consequences

**Positive:**

- Both forms ADR-0124's D3 left render the fill, or each place's own fallback, on Angular, like the
  other six targets. `dynamic/default-slot-branches` pins them on all seven, toggling the conditions
  through its harness parent, and the Angular target's tests pin D1 to D6.
- No capability cell, diagnostic code or other target's output changes, and ADR-0124's outputs stay
  byte-identical.

**Negative:**

- A place with its own fallback template adds two nodes to the template, which render anchor
  comments.
- D6's places still render the slot once on Angular, with no diagnostic.

**Open:**

- D6's places, where the default slot renders more than once at a time: ADR-0126 is to take them,
  as a template slot on Angular.

## Alternatives considered

- **A diagnostic at the outlet's span.** It makes the difference loud, but leaves the forms
  unusable on Angular, where the other targets render them.
- **The fallback's values, passed as the template's context.** The template before the block
  would read the narrowed names through `let-` variables, but a plain `<ng-template>` has no
  context guard, so Angular's type checker types them `any` and no longer checks the fallback
  (L4). A fallback declared in place keeps the names as the block narrows them.
