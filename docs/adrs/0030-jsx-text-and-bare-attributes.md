# ADR-0030: JSX text means what every JSX implementation agrees on, and a bare attribute means "true"

- **Status:** Accepted
- **Date:** 2026-10-01
- **Plan:** §4.3 (whitespace follows JSX rules; elements use HTML names), §4.6, P2, P3; refines
  ADR-0017

## Context

Plan §4.3 makes JSX's whitespace rules the source of truth. But "JSX's rules" are two families of
implementations, and the targets use both. Babel (and the plugins that copy it: Vue's JSX plugin,
`babel-preset-solid`) decodes character references first, splits lines at LF/CR/CRLF including
decoded ones, turns tabs into spaces and trims spaces only. TypeScript, oxc (Vite's transform, so
the React target) and esbuild trim raw lines first, treat Unicode whitespace as whitespace, split
at U+2028/U+2029, keep tabs, and decode afterwards. They also disagree on signed references
(`&#+65;`), references past U+10FFFF and surrogate references.

The second question was what an attribute written without a value means. M0's first IR kept it as
`true` and printed it bare, so `<span aria-hidden>` became `aria-hidden=""`, which is not hidden,
while Vue's and React's JSX both give `"true"`.

## Decision

- **Text is lowered only where the implementations agree.** The analyzer reads text as Babel does,
  and also as TypeScript/oxc and esbuild do. Where the readings differ (a raw Unicode space where a
  line meets a line break, a raw U+2028/U+2029, a raw tab Babel keeps, `&#9;`, `&#10;`, `&#13;`, a
  `&#32;` Babel trims, signed, out-of-range and surrogate references), it reports UF3009
  `ambiguous-jsx-text`, with a likely fix that keeps Babel's reading and makes all three agree,
  offered only when applying every fix in the text keeps that reading and adds no new divergence.
  Characters HTML does not keep (CR, NUL, controls, noncharacters) are UF3010 wherever they are.
  The readings take such a character for a character, as Babel does, even where TypeScript, oxc
  and esbuild trim it as whitespace (U+000B, U+0085 at a line edge), so it is never UF3009, and
  applying every fix leaves exactly the unfixable diagnostics.
- **References only HTML knows warn.** A named reference HTML decodes but JSX does not (`&check;`,
  `&rbrace;`) is UF3011 `html-only-reference`, a warning with a likely numeric-reference fix; the
  text is lowered as JSX reads it, literally.
- **The emitters print any IR text exactly.** Each target writes text its JSX compiler or template
  compiler would rewrite as something it keeps (ADR-0026), so the IR's text is the DOM's on every
  target. The JSX targets write text holding JavaScript whitespace (`\s`, plus U+0085 and U+200B,
  which TypeScript, oxc and SWC also trim) as a string expression; a probe against oxc pins the set.
- **`true` only for HTML's boolean attributes.** `StaticAttribute.value === true` only for an HTML
  boolean attribute (`isBooleanAttribute` in `@unframework/ir`), which is on by being present. A bare
  attribute whose HTML value can be `"true"` (ARIA states, `draggable`, `spellcheck`, `data-*`)
  lowers to `"true"`. Any other bare attribute is UF3004, because `"true"` is never what HTML means
  there (`download`, `title`, `crossorigin`); it gets a likely `=""` fix where an empty value is
  accepted. A boolean attribute written with a value is UF3004 too, with a fix when the value is
  redundant (`disabled=""`).
- **Names are HTML's, in lower case.** React spellings and case variants are UF3004 with a safe
  rename (`className` → `class`); names a target's template language reserves are UF3005; names
  that are not attributes of the element are UF3006 (ADR-0017).

## Consequences

**Positive:**

- An author never gets text or an attribute that one target renders differently from another; the
  compiler says so, at the source, with a fix where one exists.

**Negative:**

- Some text that is valid JSX in one tool is rejected until it is written unambiguously, and M0 has
  no expressions (`{"\n"}`), so a few characters cannot be written at all yet (M1).

## Evidence

- `packages/analyzer/test/jsx-conformance.test.ts` runs every case through Babel, oxc-transform and
  esbuild, and checks that the analyzer accepts exactly the text they agree on; mutations of the
  readings fail it. Text holding a character HTML does not keep must be read like the same text
  with a letter in its place, which the tools are compared on. A seeded fuzz of 10,000 texts
  (vertical tabs, U+0085, references, HTML-only names) applies every fix and recompiles. TypeScript's reading is implemented in the analyzer, because only the test
  toolchains may load TypeScript's API; a reviewer checked it against TypeScript 6's own JSX
  transform on 1,666 random accepted samples.
- `packages/codegen/test/render-parity.ts` and every target's render-parity test check that the
  emitted text renders as the IR's.
