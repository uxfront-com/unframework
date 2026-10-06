# ADR-0031: Normalisation removes only the target's own noise, and recognises generated ids by provenance

- **Status:** Accepted, amended by ADR-0044
- **Date:** 2026-10-01
- **Plan:** §7.5 (normalisation), §7.7, P2; refines ADR-0018 and ADR-0024

## Context

Plan §7.5 says DOM, HTML and trace comparison normalises only framework noise, and that each rule
has a negative test proving it does not erase a real difference. The adversarial review found three
ways M0's normaliser could still erase one:

- **By shape, not provenance.** Generated ids were recognised by each framework's id format. Qwik's
  format matches any short word, so an authored `id="email"` was renamed on Qwik only; Svelte's
  (`s1`) and Solid's (`cl-1`) did the same for ordinary ids, and without a target two different
  authored ids compared equal.
- **Every framework's rules on every target.** Attributes such as `data-hk` (Solid), `ng-version`
  (Angular) or `data-astro-cid-*` (Astro), and Angular host unwrapping, were removed from every
  target's output, the Vue reference's included. A target that dropped an authored attribute of
  that name still passed.
- **Serialise, then re-parse.** The live DOM was written as HTML and parsed again, so a DOM that
  HTML cannot express (an SVG child created in the HTML namespace, which renders nothing) came
  back "repaired" and compared equal to the correct one.

## Decision

- **Noise is per target.** Each framework-noise attribute rule names its framework and applies only
  to that target; Angular host unwrapping runs only for `angular`. Without a target nothing is
  noise. The harness always names the target, and refuses one the normaliser does not know.
- **Generated ids carry a reserved prefix.** Only ids starting with `uf-id-` are canonicalised.
  The analyzer and the normaliser read references with one rule, `replaceIdReferences` in
  `@unframework/ir`: `id` and every HTML and ARIA idref attribute (`ID_REFERENCE_ATTRIBUTES`,
  including `itemref`, `commandfor` and `aria-actions`), a `#id` value in any URL attribute, and
  `url(#id)` in any other value. The analyzer rejects authored ids and references with that prefix
  (UF3005), and M2's `useId` lowering must prepend `uf-id-` to the framework's own id on every
  target.
- **The live DOM must be expressible as HTML.** `normalizeDom` walks the live subtree and the
  re-parsed tree side by side and throws on any namespace, local-name or attribute difference
  (`xmlns` attributes excepted, which runtimes set without a namespace), on a table row without the
  `<tbody>` the parser would insert, and on text or attribute values the parser reads back changed.
- **Whitespace follows Chromium's own rules**, taken from Blink's inline-items builder, including
  rubies, bidi isolates and inline list items, and a seeded fuzz test fails on any pair the rule
  equates that Chromium lays out differently. One exception to "whitespace that does not render is
  removed": a whitespace text that collapses away beside a ruby is kept, printed as `""`, because
  Chromium's ruby layout depends on it. Table-internal `display` values set inline are not modelled
  yet (M1).
- Stylesheets are out of scope until M4: the rule reads inline styles and user-agent defaults only.

## Consequences

**Positive:**

- A target can only pass by producing the reference's DOM, minus noise its own framework adds.
- M2's id cases have a contract before they are written.

**Negative:**

- An authored attribute that happens to share a framework's noise name is still erased on that
  framework's target; the analyzer rejects the known ones (UF3005) so the case cannot arise from a
  `.uf.tsx` source.

## Evidence

- `packages/testing/test/normalize*.test.ts`: each rule with its negative test, including authored
  ids such as `email`, `s1` and `cl-1` on every target.
- `normalize.whitespace.browser.test.ts`: 20,000 seeded trees against Chromium's layout in CI, 0
  false equals; 300,000 run locally, plus 60,000 with a wider element set (lists, rubies, bidi).
- `dom.browser.test.ts`: an HTML-namespace `<circle>` inside `<svg>` and a table row without
  `<tbody>` make `normalizeDom` throw.
