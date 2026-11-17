# ADR-0110: Examples carry metadata in a doc comment

- **Status:** Accepted
- **Date:** 2026-11-17
- **Plan:** §8.6, §9 M7, P2, P3, P8; ADR-0087, ADR-0088; amends ADR-0087

## Context

ADR-0087 gave an example an id, a file and a name, and nothing else. `unframework preview`
(ADR-0088) lists the examples flat, by id, under one heading. A design system with dozens of
examples, like Inkline's 53, needs them grouped and named the way Storybook titled them
(`Components/Actions/Button`), with a description and an order within each group.

The metadata has to sit with the example, change nothing any target emits and nothing `visual`
captures, and need no change to the language. A `.uf.tsx` file may export only components and
injection keys (UF2033), so an `export const meta` would be a language change for seven targets.
A comment is not: `@unframework.dev/parser` already returns a module's comments, and comments
don't render.

## Decision

- **Metadata is a doc comment on the example's default export.** The comment directly before
  `export default`, with nothing but whitespace between them. A plain block or line comment, or a
  doc comment on another statement, is not read.

  ```tsx
  /**
   * Every colour the theme defines, on the solid variant.
   * @category Components/Actions/Button
   * @title Colors
   * @order 2
   */
  export default function ButtonColors() { … }
  ```

- **The comment's text is the description.** `@category` (groups split on `/`, outermost first),
  `@title` and `@order` (a finite decimal number) set the others. A tag's value runs to the next
  tag, over several lines. Other tags are ignored.
- **Derived values by default.** `Example` gains `category: string[]`, `title`, `description?` and
  `order?`, and `discoverExamples` fills the first two from the path alone:
  - The category is the example's directory name, or its parent's when the directory is named
    `examples`, in title case with `-` and `_` as spaces (`field-group` gives `Field Group`). An
    example at the root, or in a root `examples/`, is in `Examples`.
  - The title is the file name in words (`ButtonColors` gives `Button Colors`), without a leading
    run of words equal to the derived category's last group's words, when words remain
    (`Button Colors` in `Button` gives `Colors`).
- **Order.** The preview sorts examples by `order`, those without one last, then by title, then
  by id, comparing code units, so the order is the same on every machine (P8). The id, the
  baseline names and `visual`'s report stay as they are.
- **UF7012 (`malformed-example-metadata`, a warning)** at a known tag that is empty, a
  `@category` with an empty group, an `@order` that isn't a finite decimal number, and every
  repeat of a tag given twice. The preview then uses the derived value for that field. `preview`
  and `preview build` print it.
- **Only the preview reads the comment.** `readExampleMetadata`, which the preview's
  `readCatalogue` calls, parses it; `discoverExamples`, which `visual` calls too, derives from the
  path and reads no file. So `visual` neither reads nor reports metadata, and a comment changes
  nothing it captures.

This amends ADR-0087, whose `Example` had no metadata and whose examples were ordered by id
alone.

## Consequences

**Positive:**

- A design system groups, names and orders its examples beside each one, with no new file and no
  change to any target's output.
- Examples without a comment get a useful category and title from their path, so existing
  projects need no change.
- A malformed tag is loud (P2) but never stops the preview.

**Negative:**

- The preview parses every example once more when it starts.
- `Example` has two more required fields, so code that builds one by hand must add them.
- The comment must sit on the `export default` statement. One on a function that a later
  `export default X` or `export { X as default }` exports is not read.

## Alternatives considered

- **`export const meta = { … }`.** A language change for seven targets (UF2033), and each target
  would have to emit or drop it.
- **A sidecar JSON file.** Two files per example, which drift apart.
- **A map in `unframework.config.ts`.** Far from the example it describes, and it breaks when a
  file moves.
