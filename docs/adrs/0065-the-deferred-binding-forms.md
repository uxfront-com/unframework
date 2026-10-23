# ADR-0065: The binding forms ADR-0038 and ADR-0039 deferred to M4

- **Status:** Accepted
- **Date:** 2026-10-23
- **Plan:** §4.3, §6, §9 M4, P2, P4, P7; ADR-0015, ADR-0033, ADR-0044, ADR-0054, ADR-0056;
  amends ADR-0038 and ADR-0039; builds on ADR-0063

## Context

ADR-0038 deferred four forms to M4, each a UF1002 that named M4: a `style={expr}` that is not an
object literal, a `class` part that holds an array or an object at run time, vendor-prefixed
properties and a static `display` that makes a table-internal box. ADR-0039 deferred a spread's
`style` key. Layer 3 of M4 widened the IR for them (`StyleAttribute.value`,
`DynamicClass.collection`, a spread's `style` key, and a vendor-prefixed property checked by its
form alone in `checkStyle`), and nothing lowered them yet.

The frameworks take these forms differently:

- **A style known only at run time.** Vue, Angular, Qwik and Astro take an object or a
  declaration list as the element's style. React takes only an object, Solid an object with
  kebab-case keys, and Svelte only a string: `style={{…}}` renders `[object Object]`.
- **A merge.** A component's root merges a consumer's `style` into its own (ADR-0054, ADR-0056).
  React, Solid, Qwik, Astro and Angular merge by an object spread, which spreads a string into its
  characters.
- **A class collection.** Vue's `normalizeClass`, Svelte's and Astro's clsx and Qwik's `class`
  read nested arrays and objects. React's and Solid's `cx` read strings and objects only, and
  Angular's `[class]` reads no nested array and drops an entry that holds a space.
- **Types.** Vue's and Qwik's style types and Qwik's class type have an index signature
  (`` `--${string}` ``, `Record<string, …>`), which an `interface` lacks, so a value typed by one
  fails TS2322 in those outputs. Vue's class type is `Record<string, any>`, which takes one.
- **Servers.** Solid's server escapes a style object's values but not its keys.
- **Vendor prefixes.** Chromium drops a prefixed name it does not know from the CSSOM, where a
  server keeps it in the markup. An alias (`-webkit-transform`) or a prefixed shorthand
  (`-webkit-text-stroke`) sets longhands the overlap check (`cssPropertiesOverlap`) cannot see.
  Vue's server writes a camel-case `WebkitX` key as `webkit-x`.
- **Table-internal boxes.** ADR-0044's addendum models a table-internal `display` in the
  normaliser, by the element's inline `display`, static or bound. Only the analyser still
  rejected the static one.

## Decision

- **`style={value}`** that is not an object literal is a Style bound to the value, with no
  declarations (`StyleAttribute.value`). The value is a style object keyed as an object literal is
  (camel-case standard properties, quoted custom properties), a declaration list, or nothing.
  - Its kinds are within object, string, `null` and `undefined`, or it is UF3018. A declared
    object type's members, and the members of an object literal anywhere in the value (a
    conditional's branch, a `computed`, a local constant), are checked as an object literal's
    keys and values are: each a known property in camel case or a lower-case custom property,
    never vendor-prefixed, each value a string, `0`, or a number only on `UNITLESS_PROPERTIES` and
    custom properties (UF3018 at the member). An object literal the value is, or holds as a
    conditional's branch, a side of `??`, `||` or `&&`, or in parentheses, gets every check it gets
    written in place (`lowerStyleObject`), and a vendor-prefixed key is UF3018 there: every target
    copies the object as written, and Vue's server writes `WebkitLineClamp` as
    `webkit-line-clamp`, which no browser applies.
  - An object typed by an `interface` is UF3018, with the help to declare it with `type`: Vue's
    and Qwik's style types need the index signature only a type literal has.
  - **Each target writes its own form.** Vue `:style="value"`, Angular `[style]="value"`, Qwik and
    Astro `style={value}`. React `style={styleObject(value)}`, Solid
    `style={styleProperties(value)}` and Svelte `style={styleText(value)}`, inline helpers that turn
    a declaration list into an object, an object into kebab-case keys, or an object into a
    declaration list. A helper that splits a declaration list splits it as Vue's
    `parseStringStyle` does where Vue merges one, and keeps a property only where its name is a custom
    property without a quote, `<`, `>`, `&`, `;`, `:` or whitespace, or a CSS identifier, so no
    text of the list reaches the markup but as a value the framework escapes. A standard name is
    lower-cased first, as CSS reads it, so `COLOR` applies and `marginTop` doesn't, as in the browser.
  - **Merged, it is an object first.** Where a root merges a consumer's `style` into the value,
    and where a component or a `<component is>` takes the value, whose root spreads it, React, Solid, Qwik, Astro and
    Angular turn it into an object (`styleObject`) before the spread, the consumer's spread last,
    so its declarations win. Svelte merges the texts through `mergeStyle`.
  - `style-binding` is emulated on React (`styleObject`), Svelte (`styleText`), Solid
    (`styleProperties`), Angular, Qwik and Astro (`styleObject`), and native on Vue.
- **A spread's `style` key** is the element's style: the same kinds and the same lowering as a
  style bound to its read, `attrs.style` or `attrs?.style`. ADR-0039's invariant already keeps a
  `style` of the element's own beside it out (UF3007). On a root that takes a consumer's `style`,
  the key is the root's own style, merged with the consumer's in one `style`: never two.
- **A class part that may be an array or an object at run time** (`DynamicClass.collection`, a
  prop typed `string[]`) renders the names Vue's `normalizeClass` reads: a string as it is, an
  array's entries, recursively, and an object's keys whose values are truthy.
  - An array whose entries, at any depth, can be numbers or `true` is UF3018: Vue and Qwik skip a
    number, which clsx renders as its digits, and Qwik's `ClassList` takes no `true`. An object
    typed by an `interface`, at any depth, is UF3018 too: Qwik's `ClassList` needs an index
    signature. So is an object whose values can be objects or arrays: `ClassList` takes primitives
    there.
  - Vue, Svelte, Astro and Qwik pass it to their own class. React's and Solid's `cx` read an
    array's entries too, printed only where a class has such a part. Angular writes
    `[class]="classNames([…])"`, an inline helper read through a class member, so
    `class-binding` is emulated on Angular (`classNames`).
- **Vendor-prefixed properties** are accepted where Chromium 153, the browser the tests run,
  computes them as longhands of their own and has no standard name for them
  (`VENDOR_PROPERTIES` in the analyser: `-webkit-line-clamp`, `-webkit-box-orient`,
  `-webkit-text-fill-color`, `-webkit-text-stroke-width`, …), in a declaration list
  (`-webkit-line-clamp: 2`) or an object (`WebkitLineClamp`). Any other prefixed name is UF3022:
  one with a standard name takes it (`-webkit-transform` is `transform`), and the rest are a
  name a browser drops. This records ADR-0038's looser property rule, which layer 3 admitted in
  `checkStyle`: the invariants check a prefixed name by its form, and the analyser by the table.
  Each target writes a prefixed key its own way: Vue keeps the kebab-case key, React and Qwik
  `WebkitX`, Solid `-webkit-x`.
- **A static table-internal `display`** (`display: table-row`) is accepted, as a bound one is:
  the normaliser models the box by its inline `display` (ADR-0044's addendum).

```text
Source   <p style={look}>…</p>                       look?: { color?: string }
Vue      <p :style="look">
React    <p style={styleObject(look)}>
Solid    <p style={styleProperties(props.look)}>
Svelte   <p style={styleText(look)}>
Angular  <p [style]="look">                          (Qwik and Astro: style={look})

Source   <span class={["tag", tags, states]}>        tags: string[]; states: { on?: boolean }
React    <span className={cx("tag", tags, states)}>  (cx reads arrays)
Angular  <span class="tag" [class]="classNames([tags, states])">
Svelte   <span class={["tag", tags, states]}>        (Vue, Qwik and Astro alike)
```

## Consequences

**Positive:**

- Every form ADR-0038 and ADR-0039 deferred renders the same on seven targets, and no message,
  test or comment in the analyser names M4 any more.
- A declaration list splits by one algorithm, Vue's, on every target that splits one.

**Negative:**

- React, Solid and Svelte print a helper for any style bound to a value, where the value is
  already the framework's form, since the IR does not know its type. Angular, Qwik and Astro
  print one only where a merge spreads the value.
- A style or class object must be typed with `type`, not `interface`.
- Only Chromium's own prefixed longhands are accepted: `-moz-osx-font-smoothing` and prefixed
  shorthands are not.
- **Outside the contract** (ADR-0035): a run-time style object's keys beyond those an object
  literal may hold (kebab-case or vendor-prefixed keys, numbers on properties that need a unit),
  which the targets write differently. A run-time declaration list whose quoted value holds a
  `;` (`font-family: "A;B"`), which a helper's split cuts where Vue writes the list as it is. Where a root's own declaration list and a consumer's
  object set the same multi-word property (`background-color` and `backgroundColor`), Vue's
  server writes both declarations, the later of which applies, where the others write the
  consumer's alone: the style that renders is the same, the markup is not.

## Alternatives considered

- **Keep the deferred forms UF1002.** Plan §9 puts them in M4, and ADR-0038 names M4 for them.
- **A style string or a style object, not both.** ADR-0038's deferral names both, and Vue, the
  reference, takes both; React and Svelte need a helper either way.
- **Native forms where the value is already the framework's.** `style={look}` on React needs the
  value's type, which the IR does not carry until M5's type oracle (P5).
- **Mimic Vue's merge by spelling.** Keeping `background-color` and `backgroundColor` apart would
  mean React and Qwik writing kebab-case keys, which their style types reject.
- **Accept every vendor prefix.** A prefixed name the browser drops renders on the server and not
  in a client, which L7 reports on every target but the server-only ones.

## Evidence

- `packages/analyzer/test/bindings.test.ts`: "lowers vendor-prefixed longhands and a static
  table-internal display", "names the standard property of a prefixed alias", "lowers %s, bound
  to one value", "checks the members of a style object typed %s (UF3018)", "reports a style object
  or a class object typed by an interface (UF3018)", "reports an array whose entries can be
  numbers (UF3018)", "reports a class collection holding %s at any depth (UF3018)", "checks the
  object literals in style={%s} (UF3018)", "checks a class object's values (UF3018)" and
  "lowers a spread's style key".
- `packages/target-react/test/style-object.test.ts`: React's `styleObject` reads a declaration
  list's names case-insensitively, and keeps a custom property's case.
- `packages/target-solid/test/styles.test.ts`: "keeps markup out of a style bound to a value",
  through Solid's own server render.
- `packages/codegen/test/binding-forms.test.ts`: which forms a template uses, a spread's `style`
  key read with its references, and where a whole style is merged.
- The `bindings/style-expression`, `bindings/class-runtime-collections`, `bindings/style-spread`,
  `bindings/vendor-prefixes` and `bindings/table-display` cases are green at every live layer on
  all seven targets. `style-expression` and `style-spread` each hold a child whose root merges a
  consumer's `style` over its own whole style, and `style-expression` a `<component is>` that
  takes a declaration list and an object of custom properties only. The L10 root canaries leave
  a root whose style is bound to a value as it is, since a plugin writes no code, and corrupt the
  root of the component that renders it (`setStyle` in `harness/canaries.ts`).
- Chromium 153's prefixed properties: `getComputedStyle` lists the longhands of their own, and
  `style.setProperty(name, "initial")` shows which set a standard longhand instead.
