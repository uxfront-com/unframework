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
text with the same font there, so a project's font is no threat to what live mode compares. The
audit still has a job there: when a web font fails to load, every target falls back to the same
system font, the pixels match, and only the audit notices.

## Decision

- **`liveFonts` in `unframework.config.ts`:** a list of font family names, empty by default.
  `resolveConfig` reports UF7002 for anything but a list of names that aren't empty.
- **The audit always runs.** In live mode, a glyph passes when the bundled Inter draws it, as
  before, or when its family is in the list, a web font or a system font alike. Any other font
  fails with `font-fallback`, the fallback of a listed font that didn't load included.
- **Baselines ignore the list.** A comparison with committed baselines takes Inter alone,
  whatever the project lists, since the baseline came from another machine.
- **The names are CDP's.** Chromium reports a font file's own family name, which can differ from
  the CSS `@font-face` name, so a project copies each name from the `font-fallback` message.
- **Where it reaches.** `defineTestConfig` passes the list to the run's `HarnessContext` as
  `liveFonts`, and `captureAt` reads it there, so it applies to `unframework visual` and to a
  project's own `expectParity` captures alike. The corpus has no `unframework.config.ts` and
  keeps the bundled font alone.
- The determinism reset still sets the bundled family on `:root`, so text a project's CSS doesn't
  restyle keeps rendering in Inter.

```ts
liveFonts: ["Inkline Sans", "Inkline Mono"],
```

## Consequences

**Positive:**

- A design system's examples render, and compare, in its own typeface on all seven targets.
- A web font that fails to load still fails the capture, since its fallback isn't listed.
- Baselines stay as strict as before.

**Negative:**

- A system font's name differs from one machine to the next, so a project that lists one lists
  each machine's name, like the macOS and Linux ones for `system-ui`.
- A live capture in a system font differs between machines, so it's only good for the run that
  made it. That's already true of live captures, which no run keeps.

## Alternatives considered

- **An opt-in, `"any"`, that skipped the audit in live mode,** the first form of this record. A
  listed font that didn't load went unnoticed, because every target fell back to the same font.
- **A flag on `unframework visual`.** The font is the project's, and so is the choice, so it
  belongs in the config, beside the project's Vite config (ADR-0104), and reaches `test` too.
- **Let baselines take the listed fonts too.** A system font renders differently on the baseline
  image, so every baseline comparison would fail on pixels instead of on the audit's message.
