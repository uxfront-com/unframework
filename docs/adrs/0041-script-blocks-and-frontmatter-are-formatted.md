# ADR-0041: Script blocks and Astro frontmatter are formatted as TypeScript on their own

- **Status:** Accepted
- **Date:** 2026-10-02
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

- **`formatOutput` formats each block's content as TypeScript on its own:**
  - Vue: the content of `<script setup lang="ts">`, not indented;
  - Svelte: the content of `<script lang="ts">`, indented two spaces;
  - Astro: the frontmatter between the leading `---\n` and the next `\n---\n`, not indented.
- **Markup stays exactly as printed** (ADR-0026). Only the block's content changes; the tags, the
  fences and everything after them are the printer's bytes.
- **Formatting stays a compiler pass.** `emit` is synchronous and oxfmt is asynchronous, so the
  blocks are found in the printed file, not passed as structure. Each file has at most one block,
  and the formatter finds it as the framework's own parser does: from the script tag to the first
  `</script` (Vue, Svelte), or from the `---` that starts the file to the next line that is only
  `---` (Astro).
- **Nothing copied into a block can end it early.** Targets write `</script` inside a copied string
  or template literal as `<\/script`, which is the same value. The analyzer rejects (UF1002) a type
  declaration that holds `</script` or a line that is only `---`, and a string default that holds
  `</script` (ADR-0034).
- **Formatting is idempotent.** L2 re-runs `formatOutput` on every golden file and fails unless the
  bytes are unchanged; that now covers the blocks too.
- **The render-parity kit renders the formatted output.** Vue's and Svelte's formatted files now
  differ from the printed ones, so their `formatted` flags change, and the kit renders both.

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

- `formatOutput` locates blocks by text. It relies on each target printing one block in the
  expected shape and on the analyzer's rejections; a target that breaks the shape is caught only by
  its golden files and L3.
- Two formatting regimes live in one file, so a reviewer sees formatter layout in the script and
  printer layout in the template.

## Alternatives considered

- **A structured `OutputFile` that carries block ranges.** Exact, but it changes the contract
  between targets, the compiler, plugins and the harness for one formatting step.
- **Format the whole file with oxfmt.** ADR-0026 rejected it: oxfmt changes the DOM of templates.
- **Leave the blocks unformatted.** The printer would own TypeScript layout as well as markup
  layout, and the blocks would read unlike the JSX targets' code (G2).
- **Leave Astro's frontmatter unformatted**, as ADR-0026 is silent on it. The frontmatter is
  TypeScript like the others, and treating it differently would be an exception with no reason.

## Evidence

- Vue's SFC parser and Svelte's parser read a `<script>` as raw text up to the first `</script`, and
  Astro's compiler ends a frontmatter at the first line that is only `---`. Without the rule, a
  copied `label = "</script>"` default would break the Vue and Svelte files at L3
  (to verify in M1).
- Every Vue, Svelte and Astro golden output is unchanged when `formatOutput` runs on it again
  (to verify in M1).
- The Vue and Svelte render-parity tests pass on formatted output (to verify in M1).
