# ADR-0010: Angular hosts are elements with `display: contents`

- **Status:** Accepted
- **Date:** 2026-10-02
- **Plan:** §11 D6; §3 (P6), §6, §7.2, §7.4, §7.5, §9 (M1, M3), R5, Appendix A, Appendix B;
  ADR-0031

## Context

Angular renders every component inside a host element that wraps the template's root (§6). The
other targets render the root directly, so the DOM differs.

- DOM and accessibility parity (L7) and visual parity (L10) compare every target against one
  shared expectation (§7.4).
- Angular has no attribute spread, so fallthrough attributes need the host or a helper directive
  (§6).
- v1 had an Angular-only `meta: { headless: true }` (Appendix B), and its Angular "collapse" logic
  leaked into shared code (P6).
- The plan decides the host strategy in M1 (§9). M1 brings the shapes that test it: a root fragment
  with several root elements, and conditionals and lists beside them (ADR-0036).

## Decision

- Angular components use an element selector, `uf-<kebab-name>` (such as `uf-counter`), and their
  host is styled `display: contents`.
- The template holds the whole render tree. A single root element, the several roots of a root
  fragment, and `@if` and `@for` blocks beside them all render inside the one host, as they render
  inside the mount container on the other targets.
- DOM normalisation unwraps Angular host elements while this strategy is in place (§7.5). The rule
  runs on the Angular target only (ADR-0031), and only for a host that carries nothing but its
  `display: contents` style and Angular's own attributes.
- Attribute selectors are deferred to M3. They make the root element the host, so they need a
  single static root and cannot express a fragment or a conditional root. The component that needs
  them, a root `<li>`, `<tr>`, `<option>` or `<dt>` inside a consumer's list, table, select or
  definition list, arrives with composition. If M3 adds them, it adds them as a target option, with
  their own cases, in a new record.
- Fallthrough attributes go on the host or through a helper directive, and slot presence is
  emulated. Both are declared in the capability matrix (§6), and both are M3's.

The Angular output of `jsx/fragments`, whose root is a fragment with conditionals beside its
elements (ADR-0034 records the `@let` and input shapes):

```ts
@Component({
  selector: "uf-article-header",
  host: { style: "display: contents" },
  preserveWhitespaces: false,
  template: `
    @let title = this.title();
    @let subtitle = this.subtitle();
    …
    <h2>{{ title }}</h2>
    @if (subtitle) {
      <p class="article-subtitle">{{ subtitle }}</p>
    }
    …
  `,
})
export default class ArticleHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  …
}
```

```text
renders   <uf-article-header style="display: contents;"><h2>…</h2><p class="article-subtitle">…</p>…</uf-article-header>
unwrapped <h2>…</h2><p class="article-subtitle">…</p>…
```

## Consequences

**Positive:**

- Consumers use Angular's ordinary element syntax: `<uf-counter>`.
- `display: contents` keeps the host out of layout, so geometry and pixels can match the other
  targets.
- Root fragments and root-level control flow need nothing Angular-specific: the template holds
  them as the other targets' outputs do.
- Host handling lives in `target-angular` and in one normalisation rule, not in shared code (P6).

**Negative:**

- The host element is still in the real DOM. Normalisation unwraps it, and that rule needs its own
  negative test proving it erases nothing else (§7.5).
- L7's accessibility tree and L11's axe run have to show that the host changes nothing for
  assistive technology.
- Fallthrough attributes and slot presence are emulated on Angular, not native (R5).
- A component whose root must sit directly inside its parent (a list item, a table row) cannot be
  written for Angular until M3 settles it.

**Open:**

- M3: whether axe-core's list, list-item and table rules see through a `display: contents` element
  between a consumer's `<ul>` and a component's `<li>`. Nobody has measured it; spike it before M3
  chooses between the helper and attribute selectors.
- M3: where fallthrough attributes land. A host that carries an authored attribute is not unwrapped,
  on purpose, so `class` and `style` fallthrough must reach the root element through a helper
  directive, or the normalisation rule must change, which needs a record that amends ADR-0031.
- If the attribute-selector option ships, both strategies need cases.

See also ADR-0018, ADR-0019 and ADR-0024: M0's spikes rendered and measured this host.

## Alternatives considered

- **Attribute selectors by default.** The consumer's own element becomes the host, so there is no
  wrapper to unwrap. But the consumer then writes the host element in their own template, unlike
  on the other targets; the root's attributes move into `host: {…}` metadata; a root fragment or a
  conditional root cannot be expressed; and mounting needs `createComponent(type, { hostElement })`
  with an element made from the root tag, in both the client and the server adapter.
- **Attribute selectors as a target option in M1.** No target declares options yet
  (`Target.options` is unused), and an option doubles the Angular cases. No M1 case needs it.

## Evidence

- M0's `basics/*` cases are green at L6, L7, L10 and L11 on Angular: normalisation unwraps the
  host for L6 and L7, and L10's geometry looks through it.
- A probe rendered a root fragment with a root conditional between two elements through ngtsc and
  Angular's server renderer. The host held both elements and the conditional's comment anchor:
  `<uf-x10 style="display: contents;"><p>a</p><!--container--><p>b</p></uf-x10>`. Removing the
  anchor (ADR-0031) and unwrapping the host gives the other targets' DOM.
- `isAngularHost` (`@unframework/testing`) unwraps only an HTML-namespace `uf-*` element whose only
  attributes are a `style` with the single declaration `display: contents` and Angular's own
  attributes; its negative tests keep an authored `uf-*` element and a host with any other
  attribute. L10's geometry treats `display: contents` elements as transparent (ADR-0019).
- M1's corpus is green on Angular at every live layer. Its root fragment, `jsx/fragments` (two
  elements, a root `&&` and a root `?:` with fragment branches, in one host), passes L6, L7, L10
  and L11 there, as do the M1 cases with a single root. L10 compared it with Vue's capture of the
  same run (live pixels, ADR-0029). No corpus case has a list at its root; the kit below does.
- The render-parity kit's root suites, one per root case of
  `packages/codegen/test/render-parity-sources.ts` (`ROOT_SOURCES`) plus seeded components whose
  root is a fragment with text, interpolations, conditionals and lists at its edges, render
  through ngtsc and Angular's server renderer in
  `packages/target-angular/test/render-parity.test.ts` ("the root: a conditional, a list and a block
  at the root", "the root: a list at the root", "the root: a conditional that renders nothing", …),
  and the host's children equal the reference evaluator's DOM. `test/markup-semantics.test.ts`
  renders the markup printer's root cases the same way.
- `packages/testing/test/normalize.rules.test.ts` holds the unwrapping rule's tests: "replaces a
  display: contents host with its children", "unwraps a styled component's host, whose only other
  attributes are Angular's", "unwraps nested hosts, and joins the text they separated", "keeps a
  host with %s, so the difference it makes stays visible" (an authored attribute, another
  declaration, another display, no style, a tag without the `uf-` prefix), "does not erase a
  fallthrough attribute left on the host" and "keeps a contents wrapper in any other target's
  output, or without a target". An author cannot write a `uf-*` element in M1: a tag with a hyphen
  is UF1002.
