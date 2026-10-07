# ADR-0041: Script blocks and Astro frontmatter are formatted as TypeScript on their own

- **Status:** Accepted, amended by ADR-0051
- **Date:** 2026-10-05
- **Plan:** §5.8, §6 (signature props), §7.2 (L2), §9 M1; G2, P8; R14; amends ADR-0026

## Context

ADR-0026 decided that markup is never formatted, because oxfmt lays HTML out by CSS's whitespace
model, which no template compiler uses. Only code is formatted. It added that "when the Vue and
Svelte targets emit `<script>` blocks (M2), each block's content is formatted on its own as
TypeScript; the template never is", and said nothing about Astro's frontmatter.

Props bring those blocks forward to M1 (ADR-0034): Vue needs `<script setup lang="ts">` for
`defineProps`, Svelte `<script lang="ts">` for `$props()`, and Astro a frontmatter for
`Astro.props`. Each block holds copied type declarations and code the printer builds, which should
read like the formatted code the JSX targets already emit (G2).

## Decision

- **`formatOutput` (`@unframework/codegen`) formats each TypeScript block as TypeScript on its
  own:**
  - Vue: the content of each `<script … lang="ts">` block, not indented;
  - Svelte: the content of each `<script … lang="ts">` block, indented two spaces, as Svelte code
    is written. The print width narrows by the indentation, to 98, so an indented line still fits
    in 100 columns. A line inside a string or template literal that runs over several lines is not
    indented, because that would change the literal's value;
  - Astro: the frontmatter, from the leading `---\n` to the next line that is only `---`, not
    indented.
- **Markup stays exactly as printed** (ADR-0026). Only a block's content changes; the tags, the
  fences and everything around them are the printer's bytes, and the file ends in one newline.
  The Svelte target indents its block itself, so its unformatted output reads alike.
- **Formatting stays a compiler pass.** `emit` is synchronous and oxfmt is asynchronous, so the
  blocks are found in the printed file, not passed as structure. A block runs from a script tag
  that starts a line to the first `</script`, in any case, as Vue's and Svelte's parsers read it;
  a frontmatter runs from the `---` that starts the file to the next line that is only `---`, as
  oxlint splits an `.astro` file (Astro's own compiler is more lenient). Printed markup never
  starts a line with `<script`: the analyzer rejects the element, and text escapes `<`. Every
  TypeScript block is formatted, and only those; in M1 each target prints at most one.
- **Formatting never throws.** A block or a file that does not parse comes back with oxfmt's error,
  and `compile()` reports it as UF9001 with the unformatted file: a target printed invalid code.
- **Objects collapse.** `OUTPUT_FORMAT` sets oxfmt's `objectWrap: "collapse"`, for every formatted
  output, whole `.tsx` and `.ts` files included. oxc-codegen prints every object of two or more
  properties over several lines, which says nothing about intent, so oxfmt lays objects out by
  width alone (`style={{ color: "red", marginTop: gap }}`), as it would code written from scratch.
  No M0 golden output changed; with oxfmt's default, `"preserve"`, the goldens of eight M1 cases
  would hold objects broken over lines for no reason.
- **Nothing copied into a block can end it early.** The analyzer reports UF1002 for `</script`, in
  any case, or a line that is only `---`, in a copied type declaration, an inline props type or a
  prop's default (`checkCopiedText`); the help for `</script` says to write `<\/script`, the same
  string. The Vue target also writes `</script` in copied code as `<\/script`, as a guard that
  changes no valid output. L5's baseline turns `no-useless-escape` off for that spelling
  (ADR-0042).
- **Formatting is idempotent.** L2 formats every output file again and fails unless the bytes are
  unchanged (`formattingProblems` in `tests/integration/harness/compile-checks.ts`); that covers
  the blocks too.
- **The render-parity kit renders the formatted output.** Vue's and Svelte's formatted files now
  differ from the printed ones, so the kit renders both, on the server and in the browser, and
  compiles Vue's script block as `@vitejs/plugin-vue` does in a build and under the dev server
  (`inlineTemplate` true and false).

```vue
<script setup lang="ts">
export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
}

const { label, tone = "info" } = defineProps<BadgeProps>();
</script>

<template>
  <span :data-tone="tone">{{ label }}</span>
</template>
```

## Consequences

**Positive:**

- Script code in `.vue`, `.svelte` and `.astro` files is formatted like the `.tsx` and `.ts`
  outputs, by the same pinned oxfmt (P8).
- Markup keeps ADR-0026's guarantee: no formatter touches a byte that could change the DOM.

**Negative:**

- `formatOutput` locates blocks by text. It relies on each target printing its blocks in the
  expected shape and on the analyzer's rejections; a target that breaks the shape is caught only by
  its golden files, L2 and L3.
- Two formatting regimes live in one file, so a reviewer sees formatter layout in the script and
  printer layout in the template.
- An author cannot write `</script` or a `---` line in a default or a copied type, even where the
  target would not need the rule (React, Solid, Qwik, Angular).

## Alternatives considered

- **A structured `OutputFile` that carries block ranges.** Exact, but it changes the contract
  between targets, the compiler, plugins and the harness for one formatting step.
- **Format the whole file with oxfmt.** ADR-0026 rejected it: oxfmt changes the DOM of templates.
- **Leave the blocks unformatted.** The printer would own TypeScript layout as well as markup
  layout, and the blocks would read unlike the JSX targets' code (G2).
- **Leave Astro's frontmatter unformatted**, as ADR-0026 is silent on it. The frontmatter is
  TypeScript like the others, and treating it differently would be an exception with no reason.
- **Escape `</script` in every target instead of rejecting it.** It needs the same escape in every
  block-printing target, and a `---` line inside a copied comment or literal has no escape that
  keeps its value.
- **oxfmt's default `objectWrap: "preserve"`.** It keeps oxc-codegen's line breaks, so every
  object of two properties would take four lines in the outputs.

## Evidence

- Vue's SFC parser and Svelte's parser read a `<script>` as raw text up to the first `</script`:
  with a copied `label = "</script>"` default, Vue's `parse` reports "Invalid end tag." and Svelte
  "Unterminated string constant", and both compile with `<\/script>`. Astro's compiler
  (`@astrojs/compiler-rs` 0.5.1) keeps a `---` line inside a template literal or a comment in the
  frontmatter, but oxlint 1.86 ends the frontmatter there ("Unterminated string"), and so would
  `formatOutput`: the `---` rule is for them.
- `packages/codegen/test/format.test.ts`: "formats a Vue `<script setup lang="ts">` as
  TypeScript, unindented, and leaves the template"; "indents a Svelte `<script lang="ts">` two
  spaces, but not a literal's own lines"; "narrows the print width by the Svelte indentation";
  "formats an Astro frontmatter as TypeScript and leaves the markup"; "ends a block at its first
  `</script`, and keeps `<\/script` in a string as written"; "formats every TypeScript block, and
  only those"; "reports a block that does not parse instead of throwing".
- `packages/analyzer/test/props.test.ts`: "reports a default holding </script, which would end a
  script block", and the type-declaration and props-type cases for `</script` and a `---` line,
  each a UF1002 at the exact span.
- `packages/target-vue/test/emit.test.ts`: "writes `</script` in copied code so that it cannot end
  the block".
- L2's idempotence check passes on every golden output of the M1 corpus, the 29 Vue, 29 Svelte
  and 29 Astro files with a block included; formatting all 224 golden files again changes none.
- The `test/render-parity.test.ts` of `packages/target-vue` and `packages/target-svelte` render
  the formatted and the printed output on the server, and their `render-parity.browser.test.ts`
  mount both in Chromium; all pass on every suite of the M1 kit.
