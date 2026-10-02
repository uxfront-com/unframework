# ADR-0032: The IR has semantic invariants, checked after every plugin

- **Status:** Accepted
- **Date:** 2026-10-01
- **Plan:** §5.3 (the IR), §5.10 (compiler plugins), P2, P5; ADR-0030

## Context

The IR is plain, versioned, schema-validated JSON (§5.3, P5), and compiler plugins may transform it
through the `ir` hook (§5.10). The JSON Schema says what shape the IR has, but not what the targets
rely on: that a tag is an HTML element they can render, that `value: true` appears only on a
boolean attribute (ADR-0030), that `class` is canonical, that no attribute is set twice. The
analyzer guarantees all of that for the IR it lowers. An adversarial review showed that a plugin's
`ir` hook could still hand the targets an `onclick` string or a non-boolean `true`, which the
analyzer would have rejected, and which the targets render differently.

## Decision

- **`checkInvariants(module)` in `@unframework/ir`** checks the target invariants the schema cannot
  express:
  - every tag is an HTML element and not unrenderable (`script`, `style`, `template`, `slot`, …);
  - void elements have no children;
  - every attribute is an HTML attribute of its element (so no `on*` handlers, `key`, `ref` or
    framework props) and is set once;
  - `value === true` exactly for boolean attributes, and `class` is canonical (single spaces);
  - no code or document the compiler cannot analyse: no `javascript:` URL in a URL attribute, no
    `srcdoc`, and no `data:` URL where it loads a document into a nested browsing context
    (`iframe src`, `embed src`, `object data`). `data:` images and media, link and form
    destinations, and `blob:`/`filesystem:` URLs (content the page creates at run time) stay valid;
  - text and values hold only characters HTML keeps;
  - every component name is PascalCase in ASCII letters and digits, and differs from the others by
    more than case, since every target writes it as an identifier and names a file by it;
  - every export names a component once, under `default` or an ECMAScript IdentifierName, with
    kind `default` exactly when its name is `default`.
- **What the targets render differently is an invariant too**, so a plugin cannot bring back what
  the analyzer rejects for that reason (`packages/ir/src/portability.ts`):
  - `<search>` and `<selectedcontent>`, which Vue 3.5 resolves as components;
  - `slot` and `is`, which templates read as syntax;
  - `autofocus`, which React handles itself and does not render;
  - state attributes: an input's `value` (except on button, checkbox, hidden, image, radio, reset
    and submit inputs) and `checked`, an option's `selected`, a media element's `muted`;
  - `contenteditable` on an element with children;
  - an empty `src` or `data`, and an empty `href` except on `<a>`, which React drops;
  - a numeric attribute whose value is not in its canonical form;
  - whitespace-only text in `select`, `datalist` and the table parts, which Svelte drops.
- **`compile()` runs it after every `ir` hook**, after the schema check, and reports a result that
  breaks it as UF8001 (with JSON-pointer paths), dropping that hook's result. It also runs it on the
  analyser's own IR; a violation there is UF9001 and nothing is emitted, so no target ever receives
  IR that breaks it. Both checks walk arrays by index, so a hole is reported, as Ajv reports it.
  A plugin's module must also keep the analysed file and every span inside the source, because
  diagnostics point at those spans.
- **Target invariants, not author rules.** Rules about authoring stay in the analyzer, and a plugin
  owns them for the IR it produces: how JSX reads text (UF3009, UF3011), names the compiler and the
  frameworks reserve (`data-uf-*`, the `uf-id-` prefix, `data-hk`, `data-v-*`, …), nesting the HTML
  parser repairs, attributes that are valid but do nothing (a submission override on a button that
  does not submit), and canonical spellings (bare attributes, React names, case). The compiler's
  own canaries (`data-uf-canary`) and M2's generated ids must remain valid IR. A static `style` is
  the React target's own UF1002 until M4's style attribute kind makes it an invariant.
- The shared facts (`UNRENDERABLE_ELEMENTS`, `unanalysableUrl`, `isComponentName`, `isExportName`,
  `canonicalNumber`, the portability tables and the kept-character classification) live in
  `@unframework/ir`, used by both the analyzer and the check. The analyzer keeps the diagnostic
  codes and help, because the IR cannot import the catalogue.

## Consequences

**Positive:**

- A target can trust its input: the emitters' assumptions are checked, not hoped for, whoever
  produced the IR.
- A plugin that breaks the IR gets a precise, located diagnostic instead of divergent output.

**Negative:**

- `<search>` and `<selectedcontent>` are rejected on every target for one target's limitation,
  until targets declare per-element capabilities.
- Every new IR feature (M1 onwards) has to extend the invariants with it, or the check rejects valid
  IR; a canary that wants to corrupt output in a way the invariants forbid must use the `output`
  hook instead.

## Evidence

- `packages/ir/test/invariants.test.ts` covers each invariant with look-alikes that must pass;
  `packages/compiler/test/compile.test.ts` shows a plugin adding `onclick`, a non-boolean `true`,
  `autofocus`, a `srcdoc`, a `data:` iframe, a sparse children array, a component renamed to a path
  or a case collision, or an invalid export name, each rejected with exactly one UF8001 while every
  target keeps the analysed module's file; a canary-like hook is accepted.
- `packages/analyzer/test/portability.test.ts`: for each portability fact, the analyzer reports
  the source and `checkInvariants` rejects the IR it would lower to; the unportable elements are
  exactly the HTML elements Vue's own `isHTMLTag` does not know.
- `packages/ir/test/html.test.ts`: 10,000 seeded spellings of `javascript:` and `data:` URLs read
  as Node's WHATWG URL parser and React DOM's `sanitizeURL` read them.
- The analyzer's test helper asserts `checkInvariants` on every module its 646 tests lower.
