# ADR-0114: Examples carry a layout

- **Status:** Accepted
- **Date:** 2026-11-19
- **Plan:** §8.6, §9 M7, P2, P8; ADR-0088, ADR-0110, ADR-0111; amends ADR-0088 and ADR-0110

## Context

`unframework preview` (ADR-0088) mounts each entry in a bare frame page: a `<body>` with one
`<div data-uf-preview-root>` and no styles. So every example sits in the top-left corner of its
frame, and a button is a speck in a corner of a large empty iframe. An author also has no way to
say how an example should sit, like a row of variants with a gap between them, or a form that
takes the frame's full width.

ADR-0110 gave examples a doc comment that only the preview reads. How an example sits in its frame
is the same kind of fact: it changes the preview, never what the example renders, so `visual`
captures and baselines must not move.

## Decision

- **The tag.** `@layout` in the example's doc comment. Its value is `none`, or words separated by
  whitespace, in any order, at most one of each kind:

  | Words                                                                                                   | Sets                 | Left out         |
  | ------------------------------------------------------------------------------------------------------- | -------------------- | ---------------- |
  | `row`, `column`                                                                                         | the direction        | `row`            |
  | `justify-start`, `justify-center`, `justify-end`, `justify-between`, `justify-around`, `justify-evenly` | main-axis alignment  | `justify-center` |
  | `align-start`, `align-center`, `align-end`, `align-stretch`, `align-baseline`                           | cross-axis alignment | `align-center`   |
  | `wrap`                                                                                                  | wrapping             | no wrapping      |
  | `gap-<length>`                                                                                          | the gap              | `0`              |

  `<length>` is `0`, or digits with an optional fraction followed by `px`, `rem` or `em`
  (`^gap-(?:0|\d+(?:\.\d+)?(?:px|rem|em))$`), so `gap-.5rem`, `gap-1e2px`, `gap-+4px` and `gap-8`
  are malformed. Words are lower case.

- **The default.** An entry without the tag, a component included, is centred on both axes, in a
  row, with no gap.
- **The CSS.** The layout is inline style on the mount container, `[data-uf-preview-root]`, and
  nowhere else, so the example's own elements keep the styles their output writes. A flex layout
  is `display: flex`, `box-sizing: border-box`, `min-height: 100%` and `padding: 1rem`, with
  `flex-direction`, `justify-content`, `align-items`, `flex-wrap` and `gap` from its words. `center`
  and `end` map to `safe center` and `safe flex-end`, so an example larger than its frame falls back
  to the start edge, where scrolling reaches it. `none` is `display: block`, `min-height: 100%` and
  no padding. The frame page gains `html, body { margin: 0; height: 100%; }`, so the container
  fills the iframe and vertical centring shows. This amends ADR-0088's frame page.
- **The transport.** `readCatalogue` copies each example's layout onto its entry, and each
  target's frame module carries a `layouts` record, entry key to layout, in its `startFrame` call.
  The frame applies the entry's layout, or the default, to the fresh container it makes for each
  mount. Nothing travels in the shell's messages, so ADR-0088's protocol is unchanged, and the dev
  preview and `preview build` (ADR-0111) apply a layout the same way.
- **Malformed values.** An empty value, an unknown word, two words of one kind, `none` with other
  words, or a repeated `@layout` is UF7012 at the tag, as for ADR-0110's tags, and the example takes
  the default layout.

```tsx
/**
 * The two sizes, stacked.
 * @layout column align-start gap-12px
 */
export default function ButtonSizes() { … }
```

## Consequences

**Positive:**

- Small examples sit in the middle of their frame, and an author lays out a set of variants with
  one line.
- Every word is checked against a closed list, so a typo is a warning, never a silent no-op (P2).
- A new entry gets a fresh container, so no layout carries over from the previous selection.

**Negative:**

- Every existing example moves: it's now centred and shrunk to its content, with `1rem` of
  padding. An example that relied on the full width writes `@layout none` or
  `@layout column align-stretch`.
- A change to `@layout` needs a preview restart, as for the other tags, since the catalogue is
  read once at start.

## Alternatives considered

- **A CSS string, like `@layout display: grid; gap: 8px`.** It needs a CSS validator to stay loud
  (P2), and invites padding and backgrounds, which are out of scope.
- **The layout in the shell's render message.** A frame rendered without a shell, like a standalone
  embed, would get no layout, and ADR-0088's protocol would change.
- **Styling the frame's `<body>`.** A layout left on the body would outlive the entry that set it,
  where the fresh container per mount resets it for free.
