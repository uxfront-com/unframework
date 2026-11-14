# ADR-0097: Raw HTML through innerHTML

- **Status:** Accepted
- **Date:** 2026-11-14
- **Plan:** §4.3, §6, §7.2 L5, §9 M8; P4, P7; ADR-0033, ADR-0049; amends ADR-0037 (`innerHTML`
  keeps its M0 diagnostic) and ADR-0042 (the XSS rules and the `L5-framework-rule` canary)

## Context

Plan §4.3 lists `innerHTML` for M8, "with a warning". Until now it was UF1002, bound or static
(ADR-0037), though the authoring types accept it. Every target has a way to set an element's
content from a string of markup, and each writes it differently. Vue has `v-html`, React and
Qwik `dangerouslySetInnerHTML`, Svelte `{@html}`, Solid `innerHTML`, Angular `[innerHTML]` and
Astro `set:html`.

Two of them do more than set the markup:

- **Angular sanitises** a bound `innerHTML`. Its sanitiser keeps only the elements and attributes
  on its allow-list, so it drops `id`, `data-*` and `style` attributes, form controls and SVG,
  and warns on the console when it does. The same markup would render differently there.
- **Qwik's server** writes an empty string as an attribute, `dangerouslysetinnerhtml=""`. It
  writes `undefined` as nothing, and its client empties the element for both.

Each framework's lint plugin also has a rule against raw HTML (`vue/no-v-html`,
`svelte/no-at-html-tags`, `solid/no-innerhtml`, `astro/no-set-html-directive`). An output must
not silence its linter (ADR-0042).

## Decision

- **The source.** `innerHTML={markup}` on an HTML element, whose value is a string: an
  expression, or a static string without `\`, `&` or a line break, which reads alike in JSX and
  in JavaScript, as a static prop does. Its value can be no other kind (UF3018). Any other case
  of the name is UF3004, with a safe fix.
- **The warning.** Every use is `raw-html` (UF3051), a warning at the attribute: the markup is not
  escaped, so it must be trusted or sanitised.
- **The element.** It holds content and has no children: children beside `innerHTML`, a void
  element and a text-only element (`<textarea>`, `<option>`, …) are `raw-html-content`
  (UF3052). An SVG element, a spread's `innerHTML` key and `innerHTML` on a component stay
  rejected (UF1002, UF3035). A template ref's write of `innerHTML` stays UF3028 (ADR-0049).
- **The IR.** A new attribute kind, `RawHtml`, with the markup's expression.
- **The capability.** `raw-html`, native on six targets and emulated on Angular:

| Target  | Output                                                                          |
| ------- | ------------------------------------------------------------------------------- |
| Vue     | `v-html="markup"`, ordered last, as `vue/attributes-order` puts content         |
| React   | `dangerouslySetInnerHTML={{ __html: markup }}`                                  |
| Svelte  | `{@html markup}`, as the element's content                                      |
| Solid   | `innerHTML={markup}`                                                            |
| Angular | `[innerHTML]="markup \| trustedHtml"`, through the pipe below                   |
| Qwik    | `dangerouslySetInnerHTML={markup \|\| undefined}`, a non-empty literal as it is |
| Astro   | `set:html={markup}`                                                             |

- **Angular keeps the markup exact.** A pure pipe, `TrustedHtmlPipe`, printed before the
  component, passes the markup through `DomSanitizer.bypassSecurityTrustHtml`. A pure pipe runs
  again only when the string changes, so change detection sees one trusted value per string. The
  output imports `@angular/platform-browser`, Angular's own package, which L5's allow-list now
  names beside `@angular/core` and `@angular/common` (P7).
- **The contract.** The element's content is what the browser parses from the markup, on the
  server render and in the client alike. The markup must be content its element permits: a
  `<div>` inside a `<p>` closes the `<p>` on the server and stays inside it in the client, and
  most servers drop a line feed that starts the markup of a `<pre>`. The analyser cannot see run-time
  markup, so that is the author's to keep.
- **Amends ADR-0042.** `vue/no-v-html`, `svelte/no-at-html-tags`, `solid/no-innerhtml` and
  `astro/no-set-html-directive` judge the author's choice, which the source makes explicitly and
  the analyser reports. They are off, each with this reason. The `L5-framework-rule` canary writes
  a `v-bind` modifier Vue does not have (`vue/valid-v-bind`) and `set:text` on Astro
  (`astro/no-set-text-directive`) instead.
- **Amends ADR-0037.** `innerHTML` leaves its list of attributes that keep their M0 diagnostics.

```text
Source   <div class="body" innerHTML={body} />
Angular  <div class="body" [innerHTML]="body | trustedHtml"></div>
```

## Consequences

**Positive:**

- Content a CMS or a Markdown renderer produced renders on every target, the same markup with
  its `id`, `data-*` and `style` attributes on Angular too.
- The warning names the risk once in the source, instead of each framework's linter in each
  output.

**Negative:**

- Angular skips its sanitiser. The author's warning says so, and the markup must be trusted on
  every target alike.
- Qwik's output reads `markup || undefined`, which a Qwik developer would not write for its own
  sake.
- L5 no longer reports raw HTML in an output. The IR's invariants and the analyser reject
  children beside it, which `solid/no-innerhtml` also caught.

## Alternatives considered

- **Declare Angular's sanitiser as a difference** (`raw-html` unsupported there, for
  information). The portable markup would exclude `id`, `data-*`, `style`, form controls and SVG,
  a guarantee too narrow to be useful, and Angular would warn on the console each time.
- **A component-level `computed` of the trusted value on Angular.** It cannot read a list's item,
  and a method call would make a new value on every check, which Angular's development mode
  reports as a changed expression (NG0100).
- **`:innerHTML` on Vue, which `vue/no-v-html` does not see.** It dodges the rule instead of
  writing Vue's own form.
- **Keep the XSS rules and silence them in the output.** ADR-0042 forbids a disable comment in
  an output.
