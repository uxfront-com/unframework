# ADR-0010: Angular hosts are elements with `display: contents`

- **Status:** Proposed — the plan proceeds on the recommendation
- **Date:** 2026-10-01
- **Plan:** §11 D6; §3 (P6), §6, §7.2, §7.4, §7.5, §9 (M1), R5, Appendix A, Appendix B

## Context

Angular renders every component inside a host element that wraps the template's root (§6). The
other targets render the root directly, so the DOM differs.

- DOM and accessibility parity (L7) and visual parity (L10) compare every target against one
  shared expectation (§7.4).
- Angular has no attribute spread, so fallthrough attributes need the host or a helper directive
  (§6).
- v1 had an Angular-only `meta: { headless: true }` (Appendix B), and its Angular "collapse" logic
  leaked into shared code (P6).

## Decision

- Angular components use an element selector, such as `uf-counter`, and their host is styled
  `display: contents`.
- DOM normalisation unwraps Angular host elements while this strategy is in place (§7.5).
- Attribute selectors are a target option. The option replaces v1's `meta: { headless: true }`
  (Appendix B).
- Fallthrough attributes go on the host or through a helper directive, and slot presence is
  emulated. Both are declared in the capability matrix (§6).

```ts
@Component({
  selector: "uf-counter",
  host: { style: "display: contents" },
  template: `…`,
})
export class Counter implements OnInit {
  // …
}
```

## Consequences

**Positive:**

- Consumers use Angular's ordinary element syntax: `<uf-counter>`.
- `display: contents` keeps the host out of layout, so geometry and pixels can match the other
  targets.
- Host handling lives in `target-angular` and in one normalisation rule, not in shared code (P6).

**Negative:**

- The host element is still in the real DOM. Normalisation unwraps it, and that rule needs its own
  negative test proving it erases nothing else (§7.5).
- L7's accessibility tree and L11's axe run have to show that the host changes nothing for
  assistive technology.
- Fallthrough attributes and slot presence are emulated on Angular, not native (R5).
- If the attribute-selector option ships, both strategies need cases.

**Open:**

- The plan decides the Angular host strategy in M1 (§9). Until then this record holds the
  recommendation, and M1's cases may change it.

See also ADR-0018, ADR-0019 and ADR-0024: M0's spikes rendered and measured this host.

## Alternatives considered

- **Attribute selectors by default.** The consumer's own element becomes the host, so there is no
  wrapper to unwrap. The consumer then writes the host element in their own template, unlike on the
  other targets. The plan keeps attribute selectors as an option rather than the default, and gives
  no further reason; M1 confirms the choice.
