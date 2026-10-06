# ADR-0037: A bound value must render the same on every target, or the analyzer rejects it

- **Status:** Accepted
- **Date:** 2026-10-05
- **Plan:** §4.3, §5.3, §6, §7.5, §9 M1; G2, P2, P3, P4; R5; ADR-0017, ADR-0026, ADR-0030,
  ADR-0033, ADR-0035; amends ADR-0032

## Context

M0 had only static attributes. ADR-0030 fixed what a bare attribute means, and ADR-0032 made the
targets' assumptions IR invariants. M1 binds expressions to attributes (`title={label}`) and
interpolates them as text (`{count}`). The same JavaScript value then renders differently from
target to target, and the frameworks' types disagree on what an attribute accepts:

- **Booleans.** Each framework has its own list of boolean attributes. Outside its list, `false`
  renders `="false"`, which HTML reads as present. On `data-*` attributes Qwik drops `false` where
  the others render `"false"`.
- **Numbers.** React and Qwik type `tabIndex`, `colSpan`, `maxLength` or `rows` as `number`, and
  reject strings; the vendored Vue types accept both. They type `title` and `id` as `string`.
- **Tokens.** Some targets type an enumerated attribute as a union of its keywords, with no
  `string` to fall back on: `autocomplete` on Svelte and Qwik, `role` on Solid and Astro. A bound
  `string` type-checks in the source, whose types are Vue's, and fails L4 on those targets.
- **Names.** Some framework's element types do not declare an attribute HTML has: React's and
  Vue's lack `ismap`, `ping`, `writingsuggestions`, `command` and `commandfor`; Vue's lack
  `popover`; Vue's and Svelte's lack ARIA 1.3's drafts. Vue's types are also the authoring types.
- **Angular's security schema** refuses some bindings outright: resource URLs throw NG0904 for any
  plain string, and iframe policy attributes throw NG0910.
- **First selection.** A drop-down selects its first enabled option and a list box none, and
  Svelte's, Solid's and Qwik's clients insert a `<select>`'s options before they set a bound
  `size`, `multiple` or `disabled`, so the browser has selected the first option by then.
- **Nullish values.** Angular's property binding `[title]` renders `title="null"`.

## Decision

- **Name checks run first**, whatever the value form (UF3004 to UF3007, ADR-0030, ADR-0017):
  events, `ref`, `v-model`, form state and the names some framework's types lack are UF1002,
  framework syntax UF3005, an attribute the element does not take UF3006, and `srcdoc` UF3008.
  Then, on the element: duplicates (UF3007), the element's own rules, the value, and last the
  canonical spelling (UF3004).
- **Literal bindings are not canonical** (UF3004, P3), each with a safe fix offered only when it is
  the only edit on that attribute, and a removal only when the name is set once on the element:
  - `name={"literal"}` or a template literal without expressions → `name="literal"`, unless it
    holds `&`, `"`, a line break or an escape sequence, which a JSX attribute string reads
    differently; then it is accepted as Static, with the literal's value;
  - `name={true}` → bare `name` on an HTML boolean attribute and on `aria-*`, `contenteditable`,
    `draggable` and `spellcheck`, where bare means `"true"`; `name={false}` → removed on a boolean
    attribute and `name="false"` on the others; elsewhere a boolean literal is Bound, and checked
    as one;
  - `name={null}` and `name={undefined}` → removed;
  - a finite number literal → `name="<its decimal string>"` (`name={0}` → `name="0"`), except on a
    boolean or string-only attribute, where it is Bound.
- **`name={expr}` is Bound.** Its value kinds (ADR-0035) must fit the attribute, or UF3018
  `unportable-binding` (an `unknown` kind is accepted). The rows are checked in this order:

  | Attribute                                                                                    | Accepted kinds                                |
  | -------------------------------------------------------------------------------------------- | --------------------------------------------- |
  | `BINDABLE_BOOLEAN_ATTRIBUTES` (those Vue and Svelte both render `false` for as no attribute) | boolean, nullish                              |
  | `NUMBER_TYPED_ATTRIBUTES` and `NUMBER_TYPED_GLOBAL_ATTRIBUTES` (`number` on React or Qwik)   | number, nullish                               |
  | ARIA's string, id and id-list attributes (`aria-label`, `aria-describedby`)                  | string, nullish                               |
  | `aria-*`, `contenteditable`, `draggable`, `spellcheck`                                       | string, number, boolean, nullish, then tokens |
  | attributes the authoring types, or a target's, declare as `string` only (`title`, `id`)      | string, nullish                               |
  | `data-*` and every other attribute                                                           | string, number, nullish                       |

  A boolean, or any other kind, on the last row gets the help "Bind a string or a number:
  `String(value)`".

- **Enumerated attributes take tokens every typed target accepts** (`enumerated.ts` in the
  analyzer). A table lists, for each attribute some target restricts to keywords, the tokens Vue's,
  React's, Solid's, Qwik's, Svelte's and Astro's types all accept (Angular's `[attr.x]` is
  untyped), and whether they also take a boolean:
  - bound: a string literal or a union of them, each a listed token, or a boolean where every
    target takes one (ARIA's true/false states, `draggable`, `spellcheck`); otherwise UF3018,
    listing the tokens. So `contenteditable` takes only its keywords, and an ARIA state no number;
  - static: a keyword in another case, or an empty value HTML reads as a keyword
    (`spellcheck=""`, `popover=""`, a `<button>`'s `type=""`), is UF3004 with a safe fix; any other
    value some target does not list is UF3008 (`<bdo dir="auto">`, `autocomplete="bday"`). `dir`
    takes `ltr`, `rtl` and `auto` on every element, and only `ltr` and `rtl` on `<bdo>`, where
    Solid's types leave out `auto`;
  - `role` is limited to WAI-ARIA 1.1's roles, the ones Solid's and Astro's types list: no ARIA
    1.2 roles such as `generic`, and no DPUB or Graphics roles.
- **Number-typed static values are canonical numbers.** A static value of a number-typed attribute
  that is no number is UF3008; one in another spelling (`tabindex="01"`) is UF3004 with a safe fix
  to the canonical form. React and Qwik print such values as number literals (`tabIndex={0}`,
  `width={40}`), Qwik-only entries included.
- **Some attributes cannot be bound in M1** (UF1002, each with its reason, static values valid):
  - the HTML boolean attributes outside `BINDABLE_BOOLEAN_ATTRIBUTES`: `hidden`, `itemscope`,
    `playsinline` and the `shadowroot*` attributes. Vue's server or Svelte renders `false` as
    `="false"`, and their types reject the `""` spelling that would fix it. (`inert` is bindable.)
  - `UNBINDABLE_ATTRIBUTES` (`@unframework/ir`), all in the vocabulary: `<iframe>` and `<embed>`
    `src` and `<object>` `data`, which Angular reads as resource URLs (NG0904) and which could
    load a `data:` document past ADR-0032's check; `<iframe>` `allow`, `allowfullscreen`,
    `referrerpolicy` and `sandbox`, which Angular refuses to bind (NG0910); and a `<select>`'s
    `size` and `multiple` and an `<option>`'s or `<optgroup>`'s `disabled`, which decide the first
    selection (M3, with form state). The other attributes in Angular's two security contexts
    (`frame` `src`, `codebase`, `csp`, `credentialless`, `fetchpriority`) are not in the
    vocabulary at all.
  - form state, `autofocus`, `is`, `slot`, `srcdoc` and `innerHTML` keep their M0 diagnostics,
    bound or static;
  - a bound `value` that may be `null` or `undefined` on `<li>`, `<meter>`, `<progress>`,
    `<data>`, `<button>`, an `<input>` of a type whose value is a label or a submitted value, and
    `<option>` (`NULLISH_VALUE_ELEMENTS`, `@unframework/ir`): Svelte sets the `value` property,
    which these elements reflect as "0", "" or "null" once it is nullish (a `<meter>` throws on a
    first `null`), and Solid writes "0" for a `null` on an `<li>` or a `<meter>` and "null" or
    "undefined" on an `<option>`, where the other targets leave the attribute out. The help
    renders the element only where the value is there, or gives it a fallback
    (`value={score ?? 0}`). The IR holds no kinds, so `checkInvariants` cannot mirror it: a
    plugin's IR may still bind one, ADR-0032's known limit for the rules on kinds.
- **Some attributes cannot be written at all yet** (UF1002, static or bound, on every target):
  the names React's or Vue's element types do not declare (`UNDECLARED_ATTRIBUTES`: `ismap`,
  `ping`, `writingsuggestions`, `command`, `commandfor`, `dirname`, `popover`, `popovertarget`,
  `popovertargetaction`, `closedby`, a `<form>`'s `rel`, a `<source>`'s `width` and `height`, …)
  and ARIA 1.3's drafts, which Vue's and Svelte's lack (`DRAFT_ARIA_ATTRIBUTES`). Those outputs
  would fail L4, Vue's types are the authoring types, and React renders some of them by its own
  rules (it warns on `ismap` and drops `writingsuggestions={false}`). They land when the types
  declare them.
- **What a bound value renders:** `null` and `undefined` leave the attribute out; a boolean on a
  bindable boolean attribute is presence; a boolean on an ARIA state, `draggable` or `spellcheck`
  is `"true"` or `"false"`; a number is its decimal string; `""` is an empty attribute.
- **What an interpolation renders.** An Interpolation's kinds must lie within string, number,
  `null`, `undefined` and unknown, or UF3016 `non-text-interpolation`, with a help for a boolean
  (`value ? "Yes" : "No"`), an array (`.join(", ")` or `.map`) and anything else (a member).
  `null` and `undefined` render nothing; a number renders as `String(n)`.
- **ARIA values and roles are checked** against ARIA's value types and role list (UF3008, with
  ARIA-specific messages): `true` and `false` in their exact case, tokens in any case, as
  aria-query and Svelte read them. A bound literal union gets the same check.
- **Each target spells a binding its own way**, so that it renders the above and passes its L4:
  - React and Solid write every bindable boolean as it is: each is a boolean prop to React and a
    boolean to Solid's compiler, so neither needs `x ? "" : undefined` nor `bool:`;
  - React and Qwik print a number-typed static value as a number literal; Qwik also prints
    `draggable` and `spellcheck` as `{true}` or `{false}`, and a boolean attribute bare;
  - Angular binds every attribute with `[attr.name]`, never a property binding, and every boolean
    as `[attr.name]="cond ? '' : null"`; it reads props through `@let` variables (ADR-0034);
  - Astro writes the bindable booleans its renderer does not read as booleans, which leaves only
    `<input multiple>`, as `multiple={c ? "" : undefined}`;
  - Vue writes `:name="…"`, and Svelte `name={…}` or its `{name}` shorthand. Svelte writes a bound
    `value` on `<li>`, `<meter>`, `<data>`, `<button>` and `<input>` as an object spread,
    `{...{ value: x }}`: Svelte 5.57's `set_value` writes nothing on a first render when the
    property already equals the value (0 on an `<li>` or a `<meter>`'s minimum, "" on a `<data>`,
    a `<button>` and the label-like inputs, "on" on a checkbox or a radio button), where every
    other target writes the attribute, and a spread's runtime assigns the property on every render,
    which these elements reflect. A `<progress>`'s and an `<option>`'s `value` stay as they are.
- **An attribute one target's types lack on one element is an object spread there.** Where only
  Svelte's, Astro's, Qwik's or Solid's types lack a name on an element, the target writes it as
  `{...{ name: value }}`, which renders it as written and which their checkers do not reject: Svelte
  `autocorrect` outside `<input>`, Astro `autocorrect` outside `<form>`, `<input>`, `<select>` and
  `<textarea>`; Qwik `enterkeyhint` on elements other than `<input>` and `<textarea>`,
  `<input form>`, `<input list>` and a static `contenteditable="plaintext-only"`; Solid SVG
  presentation attributes its types leave out (on gradients, filter primitives and `<stop>`, and
  `direction`, `overflow` and `visibility` on most SVG elements), `edgeMode` on
  `<feGaussianBlur>`, `href` on `<mpath>`, `lengthAdjust` and `textLength` on `<textPath>` and
  `tabindex` on `<dialog>`, typed `Record<string, unknown>` where TypeScript would check the
  object otherwise.
- **Svelte's server escapes some static values twice.** It renders every attribute of an
  `<option>`, and of an element with a spread (on M1's outputs, the object spreads above), through
  its runtime, after its compiler has escaped the text already, so `title="a<b"` there renders
  `a&amp;lt;b`. The Svelte dialect writes such a static value holding `&`, `<` or `"` as a string
  expression (`title={"a<b"}`), which the server escapes once, as the client renders it.
- **Angular's literal region holds only static content.** An element that needs ADR-0026's
  `ngNonBindable` region (`{{` in a static attribute value) must bind nothing, in itself or inside
  it, because Angular binds nothing there; otherwise the analyzer reports UF1002 with that
  reason. No binding spelling replaces the region: `[attr.x]="'…'"` goes through Angular's
  sanitiser, which prefixes `unsafe:` or throws NG0904, and a bound `sandbox` or `allow` removes
  the iframe.
- **Amendments to ADR-0032.** The invariants extend to Bound attributes and spread keys: a Bound
  HTML boolean is in `BINDABLE_BOOLEAN_ATTRIBUTES`; an `UNBINDABLE_ATTRIBUTES` entry is never Bound
  or a spread key; the M0 portability rules (form state, `autofocus`, `is`, `slot`) apply to every
  kind; no attribute in `UNDECLARED_ATTRIBUTES` or `DRAFT_ARIA_ATTRIBUTES` appears in any kind; a
  number-typed static value is its own canonical number. A bound URL's run-time value is outside
  the invariants, which check static URLs only: a `javascript:` or `data:` URL at run time is
  outside the contract (ADR-0035), as React blocks it, Angular prefixes `unsafe:` and the others
  render it. Value kinds, enumerated tokens, ARIA values and the literal region are the analyzer's
  alone.

From `jsx/attribute-names`:

```text
Source   <textarea id={bioId} name="bio" rows="3" maxlength={bioLimit} readonly={locked}></textarea>
         <td colspan={seatColumns}>12</td>
React    <textarea id={bioId} name="bio" rows={3} maxLength={bioLimit} readOnly={locked} />
         <td colSpan={seatColumns}>12</td>
Vue      <textarea :id="bioId" name="bio" rows="3" :maxlength="bioLimit" :readonly="locked"></textarea>
         <td :colspan="seatColumns">12</td>
Angular  <textarea [attr.id]="bioId" name="bio" rows="3" [attr.maxlength]="bioLimit"
           [attr.readonly]="locked ? '' : null"></textarea>
         <td [attr.colspan]="seatColumns">12</td>
```

## Consequences

**Positive:**

- A bound attribute renders one DOM on seven targets, and each output type-checks under its
  framework's own types.
- Each rejection names its reason, and most name the framework that forced it, so it can be lifted
  when that framework changes or a capability lands.

**Negative:**

- Authors lose bindings HTML allows: `hidden={x}`, `playsinline={x}`, `itemscope={x}`, a bound
  iframe `src`, a bound `<select size>`, a boolean `data-*`, a `string` bound to `autocomplete` or
  `role`. Each has a written-out alternative or waits for a capability or M3.
- Authors lose attributes HTML has until the types declare them (`popover`, `commandfor`,
  `ismap`), ARIA 1.3's drafts, and the roles newer than WAI-ARIA 1.1.
- `unknown` kinds are trusted until M5's type oracle, so a value the analyzer cannot type can still
  render differently at run time.
- The token, string-only and number tables are kept by hand. The enumerated and target-string
  messages say "some targets' types", without naming the target.
- Some spellings are less familiar than the plain binding: Angular's `[attr.x]`, Astro's
  `multiple={c ? "" : undefined}`, and the object spreads.

**Open:**

- A trusted-URL helper or a capability for Angular's resource URLs, if a case needs a bound iframe.
- M3 brings form state, and with it the first-selection attributes.
- M5 types the attributes from the frameworks' types instead of hand-kept tables.

## Alternatives considered

- **Canonicalise `="true"` and `="false"` on boolean attributes in the normaliser.** It would hide
  a real difference: HTML reads `playsinline="false"` as on.
- **Declare the Angular gaps as `unsupported` capability cells.** A feature case with an unsupported
  cell cannot load its spec on that target in M1 (ADR-0043), and the analyzer can name the problem
  at the source.
- **Accept the kinds the vendored Vue types accept.** React and Qwik then fail L4 on a valid source.
- **Per-target spellings for the boolean gaps** (React's `name={x ? "" : undefined}`, Solid's
  `bool:`), as first planned. Once the analyzer kept the bindable list to what Vue and Svelte both
  read as booleans, every entry was one React and Solid already treat as a boolean, and the
  spellings were deleted.
- **Object spreads for every name a target's types lack.** On React and Vue a spread would hide the
  name from the authoring types and from React's own handling of unknown attributes.
- **A binding spelling for Angular's literal region.** Every binding goes through the sanitiser,
  so it renders differently for URLs and frame policies.

## Evidence

- Vue 3.5.43 renders `:playsinline="false"` as `playsinline="false"`, in SSR and the DOM, and
  vue-tsc rejects `:playsinline="flag ? '' : undefined"` with TS2322 (`Booleanish`). Svelte 5.57.1
  renders `itemscope={false}` as `itemscope="false"`, and svelte-check rejects `""`. Astro 7.3.5
  renders `multiple={false}` as `="false"`.
- Angular 22.2.1: `[inert]` and `[playsInline]` render nothing in its server DOM, `[itemscope]` is
  NG8002 and `[allowFullscreen]` NG0910; `[attr.inert]="b() ? '' : null"` renders and compiles
  cleanly. `[title]` with `null` renders `title="null"`.
- `packages/analyzer/test/m1-conformance.test.ts` pins the tables to their sources: the bindable
  booleans "can be bound exactly where Vue and Svelte both render false as no attribute";
  `UNBINDABLE_ATTRIBUTES` "are exactly the attributes of the vocabulary in those security contexts"
  of Angular's `DomElementSchemaRegistry`; the string-only table "are the attributes the vendored
  types declare as strings only"; ARIA's values against aria-query and Svelte's warnings.
- `packages/analyzer/test/types-conformance.test.ts` type-checks the analyzer's tables against
  the authoring, Vue, React, Solid, Qwik, Svelte and Astro element types with tsgo, both ways,
  over more than 10,000 (element, attribute) pairs: what the enumerated table accepts every typed
  target accepts, every attribute a target restricts is in it, and an undeclared name is rejected
  for exactly the frameworks whose types lack it.
- Each target pins its own spellings against its types:
  `packages/target-react/test/attributes.test.ts` (every name the IR can hold is declared, every
  boolean the IR can hold is a React boolean prop, the number-typed attributes take numbers);
  `packages/target-qwik/test/attributes.test.ts` (its names, its untyped attributes needed and
  sufficient, numbers and booleans as Qwik types them);
  `packages/target-solid/test/attributes.test.ts` (every bindable boolean is a boolean to Solid's
  compiler, over 5,000 accepted bindings type-check as written, and the spread attributes are
  exactly the ones Solid's types reject); `packages/target-svelte/test/bound-attributes.test.ts` and
  `packages/target-astro/test/attributes.test.ts` (svelte-check and `astro check` sweeps);
  `packages/target-vue/test/vocabulary.test.ts` (vue-tsc).
  `tests/toolchains/vue/tsconfig.json` declares `data-*` and `accept-charset` as attributes
  (`dataAttributes`), which Vue's types lack.
- `packages/analyzer/test/bindings.test.ts` holds the rules: "keeps the M0 checks of a name for a
  binding", the literal bindings and their fixes, "attributes holding `{{`", "attributes that
  decide a <select>'s first selection", and the kinds of each row.
  `packages/ir/test/invariants.test.ts` breaks each amendment once: "a bound playsinline", "a bound
  iframe sandbox", "a bound <select> size", "an <option>'s disabled as a spread's key", "a tabindex
  that is not a canonical number", "an attribute React's types do not declare".
- The render-parity kit's bound sweep (`boundAttributeSweep` in
  `packages/codegen/test/render-parity-node.ts`) binds every accepted (element, attribute) pair to
  a prop, 751 cases over 707 pairs, booleans both ways, and every target renders it as the
  reference evaluator says, on the server and, for the five targets with a client, in Chromium.
  `sweepDrops()` lists every pair it leaves out with the analyzer's code, and a self-test pins that
  list to the rules.
- Svelte 5.57's server escapes the static values it renders through its runtime twice:
  `packages/codegen/test/markup.test.ts` "binds a Svelte option's attribute that its server
  renderer would escape twice" and "writes static values as expressions where Svelte's server would
  escape or fold them"; `packages/target-svelte/test/emit.test.ts` "writes static text Svelte's
  server would escape twice or fold as expressions" and "renders that text on the server escaped
  once, with its whitespace"; the kit's source "static values with quotes, an ampersand and a `<`
  beside an attribute Svelte spreads" renders on all seven targets.
- Svelte 5.57's `set_value` skips a value equal to the element's own:
  `packages/codegen/test/markup.test.ts` "writes a bound value Svelte would skip writing as an
  object spread on Svelte"; `packages/target-svelte/test/emit.test.ts` "writes a bound value Svelte
  would skip writing as an object spread" and "renders those values on the server, the element's own
  defaults included"; `test/assigned-values.browser.test.ts` "writes each bound value, the element's
  own default included, on mount and after" and "writes 0 for a value that becomes absent, as Svelte
  clears an input's"; and the kit's source "bound values equal to the element's own default", on all
  seven targets. `packages/analyzer/test/bindings.test.ts`, "a bound `value` that may be nullish":
  "reports %s (UF1002)", "accepts %s" and 'reports one on an <option>, which Svelte writes as "" and
  Solid as "null"'.
- Vue, Svelte, Astro and Angular's `[attr.x]` leave a nullish value out, render `""` as an empty
  attribute and `0` as `"0"`, and render ARIA, `draggable` and `spellcheck` booleans as `"true"`
  and `"false"`; the kit's tricky source "strings, numbers, nullish and empty values" pins it on
  all seven. React 19.3 drops `rows={0}` and an empty `src`, and logs on `title={NaN}`: values
  outside the contract (ADR-0035).
- `jsx/attribute-names` and `jsx/boolean-and-aria` are green at every live layer on all seven
  targets.
