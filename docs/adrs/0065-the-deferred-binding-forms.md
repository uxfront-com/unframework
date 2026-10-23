# ADR-0065: The binding forms ADR-0038 and ADR-0039 deferred to M4

- **Status:** Proposed
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
- **Types.** Vue's style type and Qwik's style and class types have an index signature
  (`` `--${string}` ``, `Record<string, …>`), which an `interface` lacks, so a value typed by one
  fails TS2322 in those outputs.
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
    object type's members are checked as an object literal's keys and values are: each a known
    property in camel case or a lower-case custom property, never vendor-prefixed, each value a
    string, or a number only on `UNITLESS_PROPERTIES` and custom properties (UF3018 at the
    member).
  - An object typed by an `interface` is UF3018, with the help to declare it with `type`, as a
    `class` object is: Vue's and Qwik's types need the index signature only a type literal has.
  - **Each target writes its own form.** Vue `:style="value"`, Angular `[style]="value"`, Qwik and
    Astro `style={value}`. React `style={styleObject(value)}`, Solid
    `style={styleProperties(value)}` and Svelte `style={styleText(value)}`, inline helpers that turn
    a declaration list into an object, an object into kebab-case keys, or an object into a
    declaration list. Every helper splits a declaration list as Vue's `parseStringStyle` does, so a
    list splits alike everywhere.
  - **Merged, it is an object first.** Where a root merges a consumer's `style` into the value,
    and where a component takes the value, whose root spreads it, React, Solid, Qwik, Astro and
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
  - An array whose entries can be numbers is UF3018: Vue skips them, clsx renders their digits.
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

- Six targets print a helper for a style bound to a value, and React and Solid for any of them,
  where the value is already an object, since the IR does not know its type.
- A style or class object must be typed with `type`, not `interface`.
- Only Chromium's own prefixed longhands are accepted: `-moz-osx-font-smoothing` and prefixed
  shorthands are not.
- **Outside the contract** (ADR-0035): a run-time style object's keys beyond those an object
  literal may hold (kebab-case or vendor-prefixed keys, numbers on properties that need a unit),
  which the targets write differently. Where a root's own declaration list and a consumer's
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
  numbers (UF3018)" and "lowers a spread's style key".
- `packages/codegen/test/binding-forms.test.ts`: which forms a template uses, a spread's `style`
  key read with its references, and where a whole style is merged.
- The `bindings/style-expression`, `bindings/class-runtime-collections`, `bindings/style-spread`,
  `bindings/vendor-prefixes` and `bindings/table-display` cases are green at every live layer on
  all seven targets. `style-expression` and `style-spread` each hold a child whose root merges a
  consumer's `style` over its own whole style.
- Chromium 153's prefixed properties: `getComputedStyle` lists the longhands of their own, and
  `style.setProperty(name, "initial")` shows which set a standard longhand instead.
