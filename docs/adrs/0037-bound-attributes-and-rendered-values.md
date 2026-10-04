# ADR-0037: A bound value must render the same on every target, or the analyzer rejects it

- **Status:** Accepted
- **Date:** 2026-10-02
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
- **Angular's security schema** refuses some bindings outright: resource URLs throw NG0904 for any
  plain string, and iframe policy attributes throw NG0910.
- **Nullish values.** Angular's property binding `[title]` renders `title="null"`.

## Decision

- **Name checks run first**, whatever the value form (UF3004 to UF3007, ADR-0030, ADR-0017). The
  value form then decides the kind. Events, `ref` and `v-model` keep their M0 diagnostics.
- **Literal bindings are not canonical** (UF3004, P3), each with a safe fix offered only when it is
  the only edit on that attribute and the result stays unique on the element:
  - `name={"literal"}` → `name="literal"`, only when the literal holds no `&`, `"`, `\` or line
    break, which JSX attribute strings would read differently; otherwise it is accepted as Static;
  - `name={true}` → bare `name`; `name={false}`, `{null}` and `{undefined}` → removed;
    `name={0}` → `name="0"`.
- **`name={expr}` is Bound.** Its value kinds (ADR-0035) must fit the attribute, or UF3018
  `unportable-binding` (an `unknown` kind is accepted):

  | Attribute                                                | Accepted kinds                   |
  | -------------------------------------------------------- | -------------------------------- |
  | `BINDABLE_BOOLEAN_ATTRIBUTES` (known to Vue and Svelte)  | boolean, nullish                 |
  | `aria-*`, `contenteditable`, `draggable`, `spellcheck`   | string, number, boolean, nullish |
  | `NUMBER_TYPED_ATTRIBUTES` (`number` for React or Qwik)   | number, nullish                  |
  | attributes the authoring types declare as `string` only  | string, nullish                  |
  | `data-*`, `writingsuggestions` and every other attribute | string, number, nullish          |

  A boolean on `data-*` gets the help "write `String(v)`".

- **Some attributes cannot be bound in M1** (UF1002, each with its reason):
  - the HTML boolean attributes outside `BINDABLE_BOOLEAN_ATTRIBUTES` (`playsinline`, `itemscope`,
    `inert`, …): Vue or Svelte renders `false` as `="false"`, and their types reject the `""`
    spelling that would fix it;
  - the attributes in `UNBINDABLE_ATTRIBUTES` (`@unframework/ir`): `iframe`, `embed` and `frame`
    `src` and `object` `data` and `codebase`, which Angular treats as resource URLs (NG0904); the
    iframe policy attributes `sandbox`, `allow`, `allowfullscreen`, `referrerpolicy`, `csp`,
    `fetchpriority` and `credentialless` (NG0910); and every nested-document attribute, whose bound
    value would bypass ADR-0032's `data:` check;
  - form state, `autofocus`, `is`, `slot`, `srcdoc` and `innerHTML`, which keep their M0
    diagnostics, bound or static.
- **What a bound value renders:** `null` and `undefined` leave the attribute out; a boolean on a
  bindable boolean attribute is presence; a boolean on an ARIA or enumerated attribute is `"true"`
  or `"false"`; a number is its decimal string; `""` is an empty attribute.
- **What an interpolation renders.** An Interpolation's kinds must lie within string, number,
  `null`, `undefined` and unknown, or UF3016 `non-text-interpolation` (help: `cond ? "yes" : "no"`,
  `.map`, `.join()`). `null` and `undefined` render nothing; a number renders as `String(n)`.
- **ARIA values and roles are checked** against ARIA's value types and role list (UF3008, with
  ARIA-specific messages).
- **Each target spells a binding its own way**, so that it renders the above and passes its L4:
  - React prints a bindable boolean that React's own list lacks as `name={x ? "" : undefined}`, and
    the static value of a number-typed attribute as a number literal (`tabIndex={0}`);
  - Angular binds every attribute with `[attr.name]`, never a property binding, and every boolean as
    `[attr.name]="cond ? '' : null"`;
  - Solid prints a bindable boolean that its runtime does not list as `bool:name={x}`;
  - Astro prints one it does not list as `name={c ? "" : undefined}`;
  - Qwik types static values as it wants them (`tabIndex={0}`, `spellcheck={false}`).
- **Angular's literal region holds only static content.** An element that needs ADR-0026's
  `ngNonBindable` region (`{{` in a static attribute value) must have only Static attributes and a
  static subtree, because Angular binds nothing inside it. Otherwise the analyzer reports UF1002
  with that reason, unless the Angular lane proves that a binding spelling (`[attr.x]="'…'"`)
  renders exactly for that attribute in the render-parity kit (to verify in M1).
- **Amendments to ADR-0032.** The invariants extend to Bound attributes: a Bound HTML boolean is in
  `BINDABLE_BOOLEAN_ATTRIBUTES`; an `UNBINDABLE_ATTRIBUTES` entry is never Bound or a spread key;
  the M0 portability rules (form state, `autofocus`, `is`, `slot`) apply to Bound values too. A
  bound URL's run-time value is outside the invariants, which check static URLs only: a
  `javascript:` or `data:` URL at run time is outside the contract (ADR-0035), as React blocks it,
  Angular prefixes `unsafe:` and the others render it.

```text
Source   <td colspan={columns} aria-hidden={hidden} hidden={collapsed}>{count}</td>
React    <td colSpan={columns} aria-hidden={hidden} hidden={collapsed}>{count}</td>
Vue      <td :colspan="columns" :aria-hidden="hidden" :hidden="collapsed">{{ count }}</td>
Angular  <td [attr.colspan]="columns()" [attr.aria-hidden]="hidden()"
             [attr.hidden]="collapsed() ? '' : null">{{ count() }}</td>
```

## Consequences

**Positive:**

- A bound attribute renders one DOM on seven targets, and each output type-checks under its
  framework's own types.
- Each rejection names the framework that forced it, so it can be lifted when that framework
  changes or a capability lands.

**Negative:**

- Authors lose bindings HTML allows: `playsinline={x}`, `itemscope={x}`, a bound iframe `src`, a
  boolean `data-*`. Each has a written-out alternative or waits for a capability.
- `unknown` kinds are trusted until M5's type oracle, so a value the analyzer cannot type can still
  render differently at run time.
- The per-target spellings (`bool:`, `x ? "" : undefined`, `[attr.x]`) are less familiar than the
  plain binding, though each is that framework's documented form.

**Open:**

- A trusted-URL helper or a capability for Angular's resource URLs, if a case needs a bound iframe.
- M5 types the attributes from the vendored types instead of hand-kept tables.

## Alternatives considered

- **Canonicalise `="true"` and `="false"` on boolean attributes in the normaliser.** It would hide
  a real difference: HTML reads `playsinline="false"` as on.
- **Declare the Angular gaps as `unsupported` capability cells.** A feature case with an unsupported
  cell cannot load its spec on that target in M1 (ADR-0043), and the analyzer can name the problem
  at the source.
- **Accept the kinds the vendored Vue types accept.** React and Qwik then fail L4 on a valid source.

## Evidence

- Vue 3.5.43 renders `:playsinline="false"` as `playsinline="false"`, in SSR and the DOM, and
  vue-tsc rejects `:playsinline="flag ? '' : undefined"` with TS2322 (`Booleanish`). Svelte 5.57.1
  renders `itemscope={false}` as `itemscope="false"`, and svelte-check rejects `""`. Astro 7.3.5
  renders `multiple={false}` and `ismap={false}` as `="false"`. Solid renders `itemscope={false}` as
  `itemscope="false"`, and `bool:itemscope` correctly.
- Angular 22.2.1: `[inert]` and `[playsInline]` render nothing in its server DOM, `[itemscope]` is
  NG8002 and `[allowFullscreen]` NG0910; `[attr.inert]="b() ? '' : null"` renders and compiles
  cleanly. `[title]` with `null` renders `title="null"`. Its security schema puts `iframe`, `embed`
  and `frame` `src` and `object` `data` in the resource-URL context, whose sanitiser throws NG0904
  for every plain string.
- Qwik 2.0.0-beta.47 drops `data-x={false}` and writes `data-x={true}` bare; it stringifies booleans
  only on `aria-*`, `spellcheck`, `draggable` and `contenteditable`. React 19.3 drops
  `writingsuggestions={false}` with a warning, and warns on `ismap={true}`.
- tsgo 7.0.2 rejects, with TS2322, React's static `tabIndex="0"`, a string bound to `tabIndex` on
  React and Qwik, and a number bound to `title` or `id` on React, Solid and Qwik.
- Vue, Svelte, Astro and Angular's `[attr.x]` leave a nullish value out, render `""` as an empty
  attribute and `0` as `"0"`, and render ARIA, `data-*`, `draggable` and `spellcheck` booleans as
  `"true"` and `"false"`. React 19.3 drops `rows={0}` and an empty `src`, and logs on `title={NaN}`.
- The render-parity kit's bound sweep binds every accepted (element, attribute) pair to a prop and
  renders it on all seven targets (to verify in M1).
