# ADR-0039: An attribute spread renders exactly the keys its type declares

- **Status:** Accepted
- **Date:** 2026-10-05
- **Plan:** §4.3, §6 (fallthrough), §9 M1, M3; P2, P3, P4, P6; R5; ADR-0010, ADR-0034, ADR-0037,
  ADR-0038; amends ADR-0032

## Context

Plan §4.3 lets `{...object}` spread attributes onto an element. Angular has no attribute spread
(§6, R5), and fallthrough, the spread of undeclared attributes, is M3's. M1 needs spreads whose
keys the compiler can see, and probes showed that even those render differently:

- **TypeScript types are open.** A value of type `{ id?: string }` can carry `title`, `onclick` or
  `style` at run time. `v-bind` and `{...x}` render every own key on six targets; Angular can only
  bind the keys it knows. An extra key also skips every name check (P2).
- **`class` does not merge.** On Qwik and Solid a spread `class` replaces the element's class.
  Astro renders a spread `class` next to `class:list` as two `class` attributes.
- **Some keys are not attributes.** A `key` spread renders `key="k"` on Solid, becomes the vnode key
  on Vue and is dropped on Qwik and React; a `children` key replaces the content on React and Solid.
- **vue-tsc rejects `v-bind`** of an object whose keys are all `data-*` (TS2559).

## Decision

- **A spread is accepted only when its keys are known.** `{...expr}` lowers to a **Spread** when
  the value kinds of `expr` (ADR-0035) resolve to one object type the module declares: a prop or
  a list's item, or a member of one, typed by an object type literal or a local interface or alias
  (ADR-0034). Any other source, a string, an array or a union of two object types, is UF1002,
  "spreads of objects whose keys the compiler cannot see land with fallthrough (M3)".
- **`SpreadAttribute.nullish` says whether the source may be nullish where the spread is**, as its
  kinds say once the conditions around the spread narrow it (`spread-source.ts` and
  `narrowing.ts` in the analyzer, ADR-0035): an optional prop, a `T | null` prop or one that
  defaults to `null`, an optional member, a conditional, an index (`xs[1]`), `.find()` or `.at()`,
  a list item typed `T | undefined`. The outputs read every key through `?.` exactly when it is
  set, and the analyzer sets it, since the IR does not know types: a `.` on a source that may be
  absent throws, and Angular rejects a `?.` on a member it has narrowed to an object (NG8107).
  - A condition that tests the source clears it where every target's checker narrows it, by
    TypeScript's rules as ADR-0035 records them: `{attrs && <p {...attrs} />}`, `!attrs` failing,
    any operand of an `&&`, `!(on || !attrs)`, `attrs !== undefined`, `attrs?.id && …`. An `||` that
    may hold without the source (`(on || attrs) && …`) leaves it nullable, read through `?.`. A
    list's item and a destructured prop keep their narrowing inside a list's callback that holds the
    spread (Solid's keyed callback receives the prop narrowed, ADR-0036); the object form's prop and
    a member do not.
  - A branch that renders only where the source is absent renders nothing: UF3004, with a safe fix
    that removes the spread.
  - Where the targets' checkers may read the source apart (the object form's prop or a member
    narrowed outside a list's callback that holds the spread, or a test the compiler does not
    follow, an equality with a value that is no literal, such as `attrs?.id === label`), a prop or a
    list's item reads its keys through `?.`, which every target takes, as Angular does not check its
    own template variables. Only a member, which Angular's checker narrows and then rejects a
    needless `?.` on (NG8107), is UF1002, with the help to test the source inside the callback, or
    to spread it without the condition, as a spread of an absent object renders no attribute.
- **Two spreads have a canonical spelling instead** (UF3004, P3):
  - a spread of an object literal, with a safe fix that writes out its attributes where each is a
    name the element takes, written canonically;
  - a spread whose type declares no keys, which renders nothing, with a safe fix that removes it.
- **A spread renders exactly its declared keys, on every target.** `SpreadAttribute.keys` lists
  them, each with the span of its member in the type. Keys a value carries beyond its type are not
  rendered; passing them is outside the contract (ADR-0035).
- **Every key is checked as a written Bound attribute** on that element (ADR-0037): its name, and
  its member's kinds against the attribute, `undefined` included when the member or the source is
  optional. So a key the element does not take is UF3006, a boolean attribute that cannot be bound
  (`hidden`) or an undeclared name is UF1002, and a wrong kind is UF3018. In addition:
  - `key`, `ref` and `children` are UF1002 (M3): the frameworks read them themselves;
  - `style` is UF1002 (M4);
  - a key spelt other than its attribute's name (`className`, `tabIndex`) is UF3004: a spread's keys
    are attribute names, so the member is renamed in its type;
  - a key that is also written on the element, or set by another spread, is UF3007.
- **A `class` key merges** into the element's class: one Static or Class `class` may coexist with
  one spread `class` key, whose kinds are string or nullish (UF3018 otherwise), and the rendered
  tokens are their union (ADR-0038). This amends ADR-0032: its "set once" invariant carries this
  one exception, and a spread's keys are checked by the invariants as Bound attributes are
  (ADR-0037).
- **Every target expands the spread per declared key**, so the capability `attribute-spread` is
  native on all seven, and no target prints the author's spread as a native object spread:
  - React, Solid and Qwik write one prop per key, in the target's name for it (`maxLength`), with
    the `class` key inside the element's one class expression (`cx` on React and Solid, the class
    array on Qwik); on Solid, a source a condition narrows is read as the value its keyed
    callback received (`<Show keyed when={props.signature}>{(signature) => …signature.id…}`,
    ADR-0036);
  - Vue writes one binding per key, with the `class` key in `:class`; Svelte and Astro one
    attribute per key, with it in `class={[…]}` or `class:list`;
  - Angular writes one `[attr.name]` binding per key, a boolean as `cond ? '' : null`, and the
    `class` key in its `[class]` binding.

  The JSX targets read the `class` key last in the class expression; the markup targets merge every
  class source into one class at the first source's place, so a spread written before the
  element's `class` puts its key first (`class:list={[row.class, "link-row", …]}`).

  A target that writes an attribute its framework's types do not declare on that element as an
  object spread, such as Qwik's `{...{ list: "colours" }}`, spells one written attribute; that is
  ADR-0037's, not an author's spread.

The `bindings/spreads` case:

```tsx
interface HintAttributes {
  id: string;
  title?: string;
}

export interface TextFieldProps {
  // …
  field: FieldAttributes; // name, placeholder, autocomplete, maxlength, required, title
  hint?: HintAttributes;
}

<input id={inputId} type="text" {...field} />
<p class="text-field-hint" {...hint}>{hintText}</p>
```

```text
React    <input id={inputId} type="text" name={field.name} … maxLength={field.maxlength}
           required={field.required} title={field.title} />
         <p className="text-field-hint" id={hint?.id} title={hint?.title}>
Vue      <p :id="hint?.id" class="text-field-hint" :title="hint?.title">{{ hintText }}</p>
Angular  <input [attr.id]="inputId" type="text" [attr.name]="field.name" …
           [attr.required]="field.required ? '' : null" [attr.title]="field.title" />
```

And the `class` merge of `bindings/class-merge`, `<a href={href} class="text-link" {...link}>`:

```text
React    <a href={href} className={cx("text-link", link.class)} title={link.title} rel={link.rel}>
Vue      <a :href="href" class="text-link" :class="link.class" :title="link.title" :rel="link.rel">
Svelte   <a {href} class={["text-link", link.class]} title={link.title} rel={link.rel}>
Astro    <a href={href} class:list={["text-link", link.class]} title={link.title} rel={link.rel}>
```

## Consequences

**Positive:**

- A spread means the same on seven targets, Angular included, and every rendered key has passed the
  same checks as a written attribute.
- The `class` merge is the one place a spread meets a written attribute, and it is a union
  everywhere.

**Negative:**

- A spread is not a pass-through: a consumer who passes extra keys sees them dropped, silently at
  run time. The type is the contract.
- Spreads of objects from setup code, of `Record<string, string>` or of imported types wait for M2,
  M3 and M5.
- Outputs are longer than a native spread, one binding per key.

**Open:**

- M3's fallthrough decides how undeclared attributes reach the root, including Angular's helper
  directive (ADR-0010).

## Alternatives considered

- **Native spreads on six targets, with Angular emulated and extra keys outside the contract.**
  Idiomatic where it works, but an extra key would skip the name checks and render on six targets
  only, and the `class` merge would still need per-target work on Qwik, Solid and Astro.
- **An inline helper that picks the declared keys** (`attribute-spread: emulated`). It renders the
  same set, but adds a helper to six targets for something the compiler can expand statically
  (P7).
- **Reject spreads until M3.** Plan §9 puts spreads in M1, and typed attribute objects are common
  in design-system components.

## Evidence

- Astro 7.3.5 renders `<p class:list={["a", attrs.class]} {...attrs}>` with
  `attrs = { id: "i", class: "b" }` as `<p class="a b" id="i" class="b">`, and the normaliser
  rejects the duplicate attribute. Qwik renders `<div class="a" {...{ class: s }}>` as `class="z"`
  for `s = "z"`, and Solid replaces the class the same way. Svelte merges when the class is written
  after the spread.
- Solid's server renders a spread `key` as an attribute, Vue's `v-bind` takes it as the vnode key,
  Qwik drops it, and React drops it with a warning.
- vue-tsc rejects `v-bind="attrs"` with TS2559 when every key of `attrs` is `data-*`, even with
  `dataAttributes: ["data-*"]`; per-key `:data-x` bindings pass.
- `packages/analyzer/test/bindings.test.ts`, `describe("spreads")`: "lowers a spread of a typed
  prop, with its declared keys" (UF3007 for a key written twice or two spreads, UF1002 for an
  array, a string or a `key`, `style`, `hidden` or function member, UF3006 for a key the element
  does not take, UF3004 for `className`, UF3018 for a number `title`), "removes a spread whose type
  declares no keys (UF3004)" and "writes a spread object literal as its attributes"; and "merges
  one spread's class with the element's own".
- `packages/analyzer/test/bindings.test.ts`, `describe("spreads")`: "reads a list's item that may
  be absent through `?.`", "narrows the source in %s", "removes a spread whose source a condition
  shows to be absent (UF3004)" and "reports a spread whose source %s tests in a way it cannot
  follow (UF1002)". `packages/codegen/test/jsx.test.ts`: "reads a spread's keys directly when its
  source is always there" and "reads every key through `?.` when the spread's source may be
  nullish". The markup cases "spreads of nullish sources: null, an absent member and a
  conditional" and "a spread of list items that may be absent", and the kit's sources "an optional
  spread source, absent and present", "spreads of sources that may be nullish (present|absent)"
  and "spreads of a list's items and of narrowed sources (present|absent)", render on every
  target; `packages/target-angular/test/output.test.ts` compiles them through ngtsc, where a
  needless `?.` would be NG8107.
- Each target pins its expansion: React's "writes a spread out key by key, merging its class into
  the element's", Solid's "writes a spread key by key, through `?.`…", Qwik's "writes a spread as
  one attribute per declared key, merging its `class`" and Vue's "prints class and style beside
  their bindings, and a spread one binding per key" (each `packages/target-*/test/emit.test.ts`);
  the markup cases "a spread whose class key merges…" and "an optional spread, absent" render
  through the markup targets' own frameworks.
- The render-parity kit spreads typed props in its tricky and seeded components, an optional source
  among them, and renders them on all seven targets against the reference evaluator, which renders
  the declared keys only and merges the `class` key.
- `bindings/spreads` (a required and an optional source, with and without the hint) and
  `bindings/class-merge` (a spread `class` beside a static and a bound class) are green at every
  live layer on all seven targets.
