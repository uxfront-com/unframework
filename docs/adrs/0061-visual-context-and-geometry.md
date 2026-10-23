# ADR-0061: Visual context and geometry for styled components

- **Status:** Accepted
- **Date:** 2026-10-23
- **Plan:** §7.5, §7.6, §9 M4; amends ADR-0019 on what L10 captures, and ADR-0031 on how the live
  DOM path reads layout

## Context

M4 brings stylesheets (§9). Three parts of the harness were built for components without them:

- **L10's geometry.** Each element records its border box and 62 computed properties (ADR-0019).
  A sheet can move a box with `top` or `left`, draw outside it with `text-shadow` or
  `outline-offset`, and generate content with `::before` and `::after`. None of these is
  captured, so a difference there shows only in the pixels, without the geometry that explains it.
- **The normaliser's layout.** The whitespace rule decides which whitespace renders from each
  element's box (ADR-0031). It reads `display`, `position`, `float`, `unicode-bidi` and
  `white-space` from the inline style and the user-agent defaults only. A class whose sheet makes
  a `<span>` a block, or a `<p>` preserve its spaces, is invisible to it, so it would call two
  DOMs equal that render differently, or the other way round. `display.ts` left this to M4.
- **The colour scheme.** Every browser project runs in the light scheme, and the startup check
  asserts it (ADR-0019). §7.6 says "Dark-theme cases opt in", and C5 needs a dark-theme case.

## Decision

- **The captured properties.** `GEOMETRY_STYLE_PROPERTIES` adds `top`, `right`, `bottom`, `left`,
  `text-shadow` and `outline-offset`, 68 in all. `filter` stays out: the `L10-root-inverted`
  canary inverts the root with it, and must still prove that the pixel comparison alone catches
  what the geometry doesn't.
- **Pseudo-elements.** Wherever an element's `::before` or `::after` computes a `content` other
  than `none`, the snapshot holds a node `<path>::before` or `<path>::after`: the same properties,
  plus `content`. The DOM gives a pseudo-element no box, so the node has none. `<q>`'s user-agent
  quotation marks are captured too.
- **Regenerated geometry.** The committed `geometry.*.json` files are regenerated, from CI's
  artefact (ADR-0062). The new properties and nodes are the only change: no existing value moves.
  The snapshot's `version` stays 1, since a reader of the old shape still reads every old key.
- **Computed layout on the live DOM path.** `normalizeDom` parses the serialised DOM again, which
  carries no computed style. So the walk that checks the parsed tree against the live one records
  each live element's computed `display`, `position`, `float`, `unicode-bidi` and
  `white-space-collapse` under its parsed element, in a side table that `display.ts` reads in
  place of the inline style. The server path (L6), and an element in a `<template>`'s inert
  content, have no computed style and keep the static reading.
- **Where the computed value is not the layout.** Chromium computes a `display` that some elements
  don't lay out by, and the static reading already models them. They keep it:
  - A replaced element (`<img>`, `<video>`, `<svg>`) and `<br>` compute `inline`, but are atomic
    and a break.
  - `<wbr>` and every element inside `<svg>` read only `display: none`: `<wbr>` lays out as text,
    which a flex or grid container does not blockify, though its computed `display` is, and SVG
    lays out
    its own children.
  - Raw text and a `<textarea>`'s value always keep their whitespace: they aren't flowing text.
  - A `<select>` keeps the static reading for `white-space`: Chromium never renders its own text,
    whatever its user-agent `white-space: pre` says.
- **A colour scheme per case.** `case.json` takes `"colorScheme": "light" | "dark"`, `light` by
  default; the corpus loader refuses any other value. The setup file reads it for the spec file's
  case and calls the browser command `ufColorScheme`, which runs Playwright's
  `page.emulateMedia({ colorScheme })`, before anything mounts. The startup check then asserts the
  case's scheme instead of light. Every spec file sets its scheme, so none inherits the one of the
  file before it on the same page. The reset keeps `color-scheme: light` and a white page: a case's
  own styles paint it dark. SSR (L6) has no colour scheme and is unaffected.
- **Stylesheets in the corpus.** A case directory may hold `.css` files beside its inputs. The
  loader reads only `.uf.tsx` inputs, the spec and `case.json`, so they are neither inputs nor
  specs. The compile project already settles every file under `__output__/<target>/`, so an
  emitted `.css` that a run no longer produces is stale like any other golden file.

## Consequences

**Positive:**

- A styled component's L10 failure names the property or the pseudo-element that differs, before
  the pixels do.
- The normaliser respects author CSS on the live path, which every browser layer that compares
  DOMs uses (L7, L9).
- A dark-theme case runs in the scheme it styles, and its startup check asserts that scheme. A
  case that doesn't opt in runs in light, and a case with any other value fails in the loader.

**Negative:**

- Every geometry file grows by six properties per element, and by a node per generated
  pseudo-element.
- The live and the static paths can now disagree on the same HTML. They do where a flex or grid
  container blockifies a ruby annotation: Chromium computes `display: block` and lays it out as a
  plain block, where the static reading keeps its ruby traits. The live path is the exact one
  there, and both are held to Chromium's layout by the same fuzz test.
- The server path still reads only inline styles: a class that changes the layout of server HTML
  is invisible to L6's normaliser.

## Alternatives considered

- **Read the cascaded `display` from the CSSOM.** Matching every rule of every sheet against each
  element would reimplement the cascade (specificity, layers, media queries) to approximate what
  `getComputedStyle` already gives.
- **Trust the computed `display` everywhere.** Replaced elements, `<br>`, `<wbr>`, SVG children,
  `<select>` and raw text would then change the normalised DOM of cases that have no stylesheet:
  every shared expectation they appear in would move with no change in what renders.
- **A viewport per case.** Not needed: media queries are tested at the fixed 800×600 viewport,
  with one rule that matches and one that doesn't (the PLAN's non-goal).
- **Set the colour scheme in the project's `contextOptions`.** It would take a project per scheme,
  and a case's scheme would depend on the project it lands in.

## Evidence

- `packages/testing/test/geometry.browser.test.ts`: each of the six properties is captured from an
  inline style; a `::before` and an `::after` with `content` are keyed after their element, with no
  box, the whole property set and `content`; an element without generated content has no such
  node; `filter` is not captured.
- `packages/testing/test/visual.test.ts`: `diffGeometry` compares a pseudo-element's `content`.
- `packages/testing/test/normalize.stylesheet.browser.test.ts`: under an injected stylesheet,
  seven pairs of fragments that Chromium lays out the same or differently (a span made a block, a
  float, an absolutely positioned box, a `<pre>` made to collapse, a block made inline, an
  isolate, a paragraph made to preserve) are normalised the same or differently by the live
  path, as Chromium lays them out, and the opposite way by the static path. Two more pairs, the
  spaces around a float and around an absolutely positioned box, fail when the live path reads
  `float` and `position` from the inline style: Chromium computes both boxes' `display` as
  `block`, so only the computed `float` and `position` take them out of flow.
- `packages/testing/test/normalize.whitespace.browser.test.ts`: every fixture is normalised the
  same by both paths with no stylesheet; on 20,000 fuzzed fragments neither path calls two
  fragments equal that Chromium lays out differently. Without the `<wbr>` exception the live path
  read 48 fuzzed fragments otherwise than the static one, and with it 40, each with a ruby
  annotation in a flex container. Two of them, laid out alone, render as the live path reads
  them.
- Chromium's computed values on a page without author CSS: `<img>`, `<video>`, `<canvas>`,
  `<iframe>`, `<embed>`, `<object>`, `<svg>` and `<br>` compute `inline`; `<rect>` and `<g>`
  `inline`, `<text>` `block`; `<wbr>` in a flex container `block`; `<select>` `white-space: pre`;
  `<script>`, `<style>` and `<title>` `white-space: normal`; an open `<dialog>`
  `position: absolute`; `<p>`, `<div>` and `<li>` `unicode-bidi: isolate`.
- `test/parity/cases/stub/color-scheme`: a case with `"colorScheme": "dark"` passes its startup
  check, matches `prefers-color-scheme: dark` and not `light`, and a sheet's dark rule applies to
  what it mounts. `harness/cases.unit.test.ts` reads `dark` and `light` and refuses `"dim"`,
  `"Dark"`, `true` and `null`; `test/commands.test.ts` checks the command.
- `harness/cases.unit.test.ts`: a case holding `Card.css` beside `Card.uf.tsx` lists one input and
  its spec; `settleArtefactDirectory` fails on a stale `Old.uf.tsx.css` and on a changed
  `Card.uf.tsx.css`, and deletes the stale one in update mode.
