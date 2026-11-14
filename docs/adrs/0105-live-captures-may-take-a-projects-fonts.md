# ADR-0105: Live captures may take a project's own fonts

- **Status:** Accepted
- **Date:** 2026-11-14
- **Plan:** §7.2 (L10), §7.6, §8.6, R10; ADR-0019, ADR-0029, ADR-0066, ADR-0086, ADR-0087;
  amends ADR-0087

## Context

L10's font audit asks CDP which font drew each glyph of a capture, and fails any glyph not drawn
in the bundled Inter with `font-fallback` (ADR-0019). It guards the committed baselines: a glyph
in a system font renders one way on the Mac that runs a check and another on the Linux image that
wrote the baseline, so the audit fails it up front rather than as a pixel difference.

A design system sets its own font, often globally: Styleframe's theme sets the font family of
`html` and `body`. Every example of such a project fails the audit, in every pixel mode, so
ADR-0087 left it as a known gap: "an example can't show a design system's own typeface yet".

Live pixels (ADR-0029), the default for a project (ADR-0086), compare each target with the
reference's capture from the same run, in one browser on one machine. Every target draws the same
text with the same font there, so a project's font is no threat to what live mode compares.

## Decision

- **`liveFonts` in `unframework.config.ts`:** `"bundled"`, the default, keeps the audit as it is,
  and `"any"` lets any font draw a live capture, a system font or a web font the project loads.
- **Live only.** With `"any"`, the audit doesn't run when pixels compare live. A comparison with
  committed baselines still audits every glyph and fails with `font-fallback`, whatever the
  project sets, since the baseline came from another machine.
- **Where it reaches.** `defineTestConfig` passes the field to the run's `HarnessContext` as
  `liveFonts`, and the capture command reads it there, so it applies to `unframework visual` and
  to a project's own `expectParity` captures alike. The corpus has no `unframework.config.ts` and
  keeps the bundled font alone.
- The determinism reset still sets the bundled family on `:root`, so text a project's CSS doesn't
  restyle keeps rendering in Inter.

```ts
export default {
  targets: ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"],
  liveFonts: "any",
};
```

## Consequences

**Positive:**

- A design system's examples render, and compare, in its own typeface on all seven targets.
- Baselines stay as strict as before, so a project that commits them gains nothing it can trip
  over.

**Negative:**

- A live capture in a system font differs from one machine to the next, so it's only good for the
  run that made it. That's already true of live captures, which no run keeps.
- With `"any"`, a fallback the project didn't mean, like a missing web font, goes unnoticed in
  live mode, since every target falls back to the same font.

## Alternatives considered

- **Allow a named list of families.** CDP reports a font file's internal name, which differs from
  the CSS family and from one platform to the next, so a list would hold names nobody writes in
  CSS. Live mode needs no list to stay sound.
- **A flag on `unframework visual`.** The font is the project's, and so is the choice, so it
  belongs in the config, beside the plugins that load the project's CSS (ADR-0104).
- **Let baselines take any font too.** A system font renders differently on the baseline image, so
  every baseline comparison would fail on pixels instead of on the audit's clear message.
