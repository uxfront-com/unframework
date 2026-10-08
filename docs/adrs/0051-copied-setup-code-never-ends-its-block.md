# ADR-0051: Setup code copied into a script block or a frontmatter never ends it

- **Status:** Accepted
- **Date:** 2026-10-07
- **Plan:** §5.8, §9 M2; G2, P2, P8; R14; ADR-0026, ADR-0042, ADR-0045; amends ADR-0041

## Context

ADR-0041 formats each TypeScript block of a markup output on its own, and finds the blocks by
text: a script block runs to the first `</script`, in any case, as Vue's and Svelte's parsers read
it, and Astro's frontmatter runs to the next line that is only `---`, as oxlint splits an
`.astro` file. In M1 the blocks held copied type declarations, inline props types and prop
defaults, so the analyser rejected `</script` and a `---` line in those (UF1002,
`checkCopiedText`), and the Vue target escaped `</script` in copied code as a guard.

M2 copies much more into those blocks: every setup statement (ADR-0045), the handlers Vue moves to
its script, the constants and functions Astro's server render reaches, and on Svelte the whole
setup, which the target indents into its script. Probes over the new code found:

- **A `---` line ends Astro's frontmatter for some tools only.** Astro's own compiler keeps it
  inside a template literal or a comment, while oxlint (through astro-eslint-parser) reads
  "Unterminated string", and `formatOutput` cannot parse the block, which the compiler reports as
  UF9001. A line `--- middle` troubles none of them.
- **Svelte's indentation must not move a literal's lines.** M1's hand scanner, which told a
  literal's lines from code's, could be misled by a regular expression that holds a quote or a
  backtick, which M2's setup code may hold.
- **Svelte parses the markup's code as TypeScript only in a component with a `<script lang="ts">`.**
  An inline handler with a cast (`event.currentTarget as HTMLInputElement`) in a component without
  props or setup failed Svelte's parse (`js_parse_error`, L3).
- **A handler's code spans lines in the markup too.** Svelte keeps an inline handler in its
  attribute, and the printer copied its continuation lines at the source's columns: a block
  handler's body and closing brace stood several levels right of the attribute that holds them.

## Decision

- **The analyser checks every piece of copied code once**: each setup statement, and each inline
  handler, as it checks type declarations, inline props types and prop defaults. `</script`, in
  any case, is UF1002, with the help to write `<\/script` (the same string); a line that is only
  `---`, with spaces or tabs after it (`^---[ \t]*$`), is UF1002 too. That pattern is exactly the
  lines the tools misread.
- **Svelte escapes `</script` in copied code** as `<\/script`, a guard, as Vue's target does: the
  analyser rejects the text first, so no valid source reaches it. Astro has no escape: no spelling
  of a `---` line in a comment or a literal keeps its value, so the analyser's rule is the only one.
- **Svelte moves copied code to its script's indentation** by the literals oxc finds when it parses
  the code (`parseStatementsSource`, or as an expression): the first line takes the script's
  indentation, the others move by the same amount and keep their relative indentation, and a line
  that starts inside a string or template literal never moves, as that would change its value. Code
  that does not parse keeps its continuation lines as they are. M1's hand scanner stays for copied
  type declarations only.
- **Svelte declares an empty `<script lang="ts"></script>`** for a component whose markup holds
  TypeScript (a handler's cast or annotation) and that has no script otherwise. `formatOutput`
  formats it as every TypeScript block; it is still the target's only block (ADR-0041).
- **Markup stays as printed** (ADR-0026), and the printer places attribute code that spans
  lines. Vue's handlers that the template holds are attribute code (`vueAttributeCode`, now
  reading statements), and the rest move to the script. A tag with an attribute whose code spans
  lines puts its attributes one per line, and the code's continuation lines move to the
  attribute's column, keeping their indentation relative to each other (codegen's markup printer,
  `writeOpenTag` and `rebase`): a line that closes a bracket the first line opened (a handler's
  closing brace, an attachment's `}))`) goes to the attribute's column, and without one the lines
  go one indent past it (a conditional's `?` and `:`). The code is found in the attribute's text
  and read token by token, so a line that starts inside a string or template literal never moves;
  code that does not parse keeps its lines; and a static attribute's value is content, which never
  moves. No formatter touches markup: the layout is the printer's. In the corpus Svelte's goldens
  hold such attributes, and one of Vue's (`state/narrowed-reads`, an `@input` whose arrow writes an
  object literal).

A Svelte handler copied into markup, from `events/event-options`, and a setup constant the analyser
refuses:

```text
Svelte   <button
           type="button"
           onclick={(event) => {
             event.stopPropagation();
             record("stopped");
           }}
         >Stop here</button>
Source   const banner = `Welcome
         ---
         back`;                       UF1002: it would end the Astro frontmatter it is copied into
```

## Consequences

**Positive:**

- No copied code can end a script block or a frontmatter, so `formatOutput`, oxlint and each
  framework's parser read the same blocks, and a compile never fails late in a formatter.
- Svelte's script keeps a literal's value exactly, whatever the code around it holds.

**Negative:**

- An author cannot write `</script` or a `---` line in setup code or a handler, even for a target
  that would not need the rule (React, Solid, Qwik, Angular).
- The markup printer reads an attribute's code token by token to place its lines: one more place
  where a literal's lines must be found exactly, which its tests pin on Svelte and Vue.

## Alternatives considered

- **Escape `</script` in every block-printing target, and a `---` line in Astro's.** ADR-0041
  rejected it for M1, and M2 adds no reason: a `---` line in a comment or a literal has no escape
  that keeps its value, and the analyser's rule already holds for every target.
- **Keep M1's hand scanner for Svelte's setup code.** A regular expression holding a quote or a
  backtick misleads it, and setup code holds far more such code than a type declaration.
- **Give a Svelte component without TypeScript in its script plain JavaScript markup.** The
  author's cast is TypeScript; dropping it would change the code the author wrote.
- **Keep a multi-line handler's lines at the source's columns** (the first build). The body and the
  closing brace stood several levels right of the attribute that holds them, as no Svelte
  developer writes them; re-basing them by the code's own tokens moves no literal's line.
- **Re-base a static attribute's value too** (the fix's first attempt). A value's lines are its
  content: the Svelte target's seeded render-parity trees caught the changed text.

## Evidence

- `packages/analyzer/test/setup.test.ts` "reports text that would end a script block or Astro's
  frontmatter (UF1002)": a `"</script>"` in a setup constant is UF1002 at `</script`.
  `packages/analyzer/test/props.test.ts` "reports a default holding </script, which would end a
  script block" keeps M1's rule. `packages/codegen/test/format.test.ts` "ends a block at its first
  `</script`, and keeps `<\/script` in a string as written".
- Svelte 5.57.1: `packages/target-svelte/test/emit.test.ts` "emits %s so Svelte compiles it without
  a warning, formatted or not", whose `copiedCode` shape holds a regular expression with a quote and
  a backtick and a multi-line template literal; "declares an empty TypeScript script for a handler's
  cast in a component without one"; and, for M1's hand scanner, "indents the script but for the
  lines inside a literal, whose value it would change".
  `packages/target-svelte/test/toolchain.test.ts` "passes L3, L4 and L5 on what the target emits for
  each shape".
- The markup printer: `packages/codegen/test/markup.test.ts` "moves a handler's body one level in
  from the attribute, and its closing brace to it", "moves lines that close nothing the first line
  opened one level in", "never moves a line inside a template literal, or a string continued on the
  next", "keeps a static value's lines as they are: they are its content" (it fails with the code
  and the content not told apart) and "keeps the lines of code it cannot parse as they are";
  `packages/target-svelte/test/emit.test.ts` "emits the %s shape as test/fixtures/%s.svelte"
  compares `Panel.svelte`, `Pager.svelte` and `WatchEdges.svelte`, whose handlers span lines, byte
  for byte.
- Astro 7.3.5 with `@astrojs/compiler-rs`, `astro check` on TypeScript 6.0.2 and oxlint 1.86.0
  with astro-eslint-parser, over a frontmatter constant whose template literal, or a comment, holds
  the line, a probe's finding:

  | Line in a literal or a comment | Astro's compiler (L3) | `astro check` (L4) | oxlint (L5)           | `formatOutput` | Render |
  | ------------------------------ | --------------------- | ------------------ | --------------------- | -------------- | ------ |
  | `---`                          | clean                 | clean              | "Unterminated string" | fails          | right  |
  | `--- ` (a trailing space)      | clean                 | clean              | "Unterminated string" | clean          | right  |
  | `--- middle`                   | clean                 | clean              | clean                 | clean          | right  |

  A `---` line in setup code, in a prop's default and in a `computed`'s body each give UF1002, a
  probe compile's finding.

- L2's idempotence check passes on every golden output of the corpus, the 67 Vue, 67 Svelte and 67
  Astro outputs of M2's feature cases among them, and every one passes L3 and L5.
