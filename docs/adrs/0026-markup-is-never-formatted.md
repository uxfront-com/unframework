# ADR-0026: Markup is never formatted; oxfmt formats code only

- **Status:** Accepted, amended by ADR-0041
- **Date:** 2026-10-01
- **Plan:** §5.8 (formatting), P8, R14; §4.3 (whitespace); §7.2 (L2, L6, L7)

## Context

Plan §5.8 has every output formatted with `oxfmt.format()` at a pinned version, so golden files
are formatted code, with the printer's own layout as the fallback where oxfmt does not cover a
syntax (R14). In M0 the printer laid markup out so that no line break it adds can change what
renders (`printMarkup` in `@unframework/codegen`), and oxfmt then reformatted Vue files and
Angular's inline `template:`.

The adversarial review of M0 showed that the second step undoes the first. oxfmt lays HTML out by
CSS's whitespace model (`htmlWhitespaceSensitivity: "css"`), and no template compiler uses that
model:

- On a long line of inline elements, oxfmt moves the space between two `<a>` elements onto a line
  break. Vue's `condense` mode deletes a whitespace-only text node that holds a line break and sits
  between two elements, so Vue renders `compilers</a><a …>frameworks`, without the space React
  keeps. Vue is the reference target (ADR-0014), so the wrong DOM is the one update mode writes into
  the shared expectations.
- At block edges oxfmt trims or adds text (`a ` becomes `a`, `t` becomes `t`) and rewrites
  `class="  b   a  "` to `class="b a"`. Under user-agent CSS that is invisible, but it is DOM text,
  and author CSS (M4) makes it visible.
- `htmlWhitespaceSensitivity: "strict"` wraps at the same place and loses the same space.

The normaliser hid most of this from L7 (it collapses whitespace by rendering rules), and the
markup tests pinned printer strings rather than what the frameworks render, which is why the
corpus stayed green.

## Decision

- **Markup is never formatted.** `formatOutput` formats code only (`/\.[cm]?[jt]sx?$/`). Vue,
  Svelte and Astro files keep the printer's layout, and so do templates embedded in code:
  `embeddedLanguageFormatting: "off"` leaves Angular's `template:` as printed.
- **The printer owns whitespace.** Each markup dialect writes whatever its compiler would collapse
  or drop as something the compiler keeps: an interpolated string literal (Vue, Angular), an
  expression (Svelte, Astro) or `&ngsp;` (Angular), with the literal escaped for the template
  lexer (`&`, `<`, `>`, `{`, `}`, U+2028 and U+2029 as `\uXXXX`). Where Svelte keeps whitespace
  between siblings, block siblings still start on new lines, but the line break goes inside the
  tag that ends the previous run (`</header\n  ><p>`), so Svelte's DOM gets no text node the IR
  lacks.
- **Angular has no static spelling for `{{` in an attribute value.** It decodes character
  references before it looks for interpolations, and `ngNonBindable` on an element does not cover
  the element's own attributes. A binding (`[attr.href]="'…'"`) would go through Angular's
  security schema: an `unsafe:` URL, NG0904 on a resource URL, a removed iframe for a bound
  `sandbox` or `allow`. So an element with `{{` in an attribute value is printed inside
  `<ng-container ngNonBindable ngPreserveWhitespaces>`, where Angular binds nothing and keeps
  whitespace. Inside it the subtree is written with references only (`&#123;`, `&#125;`, `&#64;`)
  and no layout breaks outside tags; the container renders a comment anchor, which normalisation
  already removes. The Angular dialect never writes a binding for a static value.
- **Render-parity tests check what the frameworks render.** Every target package runs a shared
  set of tricky and seeded random IR trees, plus a sweep of every (element, attribute) pair the
  analyzer accepts, through its emitter, formatted and unformatted, then through the framework's
  own compiler and server renderer, and asserts that the rendered DOM equals the IR's DOM under JSX
  semantics (`packages/codegen/test/render-parity.ts`). React (`createRoot` after oxc), Solid, Vue,
  Svelte and Qwik also render the same trees on the client in Chromium, where their code paths
  differ from the server's; Angular and Astro do not, because their client output is the server's
  (Astro) or compiled by the same ngtsc step the server tests use (Angular; confirmed once in
  Chromium with the toolchain's browser configuration). The sweep gives each element the content
  its attributes act on (a `<select>` gets an `<option>`). A case that uses a capability the
  target's matrix marks unsupported is left out of its client comparisons, and the test checks
  that it still renders differently, so the cell is changed when the framework is fixed
  (ADR-0033).
- **Long tags wrap inside the tag.** A tag with at least one attribute whose line would pass the
  print width puts one attribute per line, a single attribute included (`<a\n  href="…"\n>`), and
  Svelte splits an over-long run of inline siblings inside a tag, so no line break ever lands in
  content. Text and tags without attributes are never broken, so a line holding long text can
  still pass the print width.
- **The whitespace mode is pinned where a component can pin it.** The layout assumes each template
  compiler's default whitespace handling. Angular components declare `preserveWhitespaces: false`
  and Svelte components `<svelte:options preserveWhitespace={false} />`. Vue's
  `whitespace: "condense"` and Astro's `compressHTML` cannot be set per file, so the bundler plugin
  must check the framework plugin's resolved option when it lands for applications (M6).
- **When the Vue and Svelte targets emit `<script>` blocks (M2)**, each block's content is
  formatted on its own as TypeScript; the template never is.

## Consequences

**Positive:**

- The DOM a target renders is exactly the IR's, whatever a line's length. The golden files and the
  unplugin's output are the same bytes as before formatting, for markup.
- The render-parity tests catch dialect mistakes before they reach the corpus: in this change they
  also found and fixed unprotected edge whitespace on Vue, entities decoded inside `{{ }}`,
  Angular collapsing Unicode spaces, and `{{` in Angular attribute values becoming bindings. A
  later review found that the binding first chosen for `{{` went through Angular's sanitizer; the
  non-binding region replaced it.

**Negative:**

- Markup golden files have the printer's layout, not oxfmt's: long text is not rewrapped, and
  Svelte breaks lines inside tags. That is less familiar than formatter output, and a
  reviewer has to accept it as the price of exact whitespace.
- The printer, not a formatter, is responsible for readable markup in every dialect.

## Alternatives considered

- **Keep formatting and add a post-format guard** that re-derives the rendered text from the
  formatted template with the dialect's whitespace rules and reports UF9001 when it differs. It
  detects the problem instead of avoiding it, and every failure would be an internal error in
  normal use.
- **`htmlWhitespaceSensitivity: "strict"`.** Measured: oxfmt still wraps between the inline
  elements, and Vue still deletes the space.
- **Formatting only Svelte and Astro, which oxfmt does not support today.** Moot: it is Vue and
  Angular that oxfmt breaks.

## Evidence

- A paragraph with four inline links: unformatted, Vue SSR renders `…compilers</a> <a …>`;
  formatted, the template holds `…compilers</a>\n    <a href="/tags/frameworks">` and Vue SSR renders
  `…compilers</a><a …>`. The same with `htmlWhitespaceSensitivity: "strict"`.
- `<p>\na </p>`: React and Svelte render `a `, Vue and Angular `a` when formatted; all four render
  `a ` unformatted.
- After the change, every target's `test/render-parity.test.ts` passes on formatted and unformatted
  output, and a mutation run with the previous `format.ts` and `markup.ts` fails on Vue, Svelte,
  Angular and Solid.
- Angular's server parity test fails on the binding spelling with `unsafe:a{{b:c`, a sanitizer
  warning and NG0904 (it captures the console), and passes with the non-binding region.
- A paragraph of six links with one `href` each printed 366-character lines before single-attribute
  tags wrapped; every markup dialect's parity test renders it exactly wrapped.
- The corpus golden files changed in layout only (Angular's template and Svelte/Astro line breaks);
  no rendered DOM changed, and the parity matrix stayed green.
