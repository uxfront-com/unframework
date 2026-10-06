# ADR-0038: `class` binds a set of tokens, and `style` binds declarations that never overlap

- **Status:** Accepted
- **Date:** 2026-10-05
- **Plan:** §4.3, §4.4, §6 (`class={[…]}`), §9 M1, M4; G2, P2, P4, P7; ADR-0015, ADR-0037;
  amends ADR-0032

## Context

Plan §4.3 gives `class` a string, array or object form and `style` an object or a string, and §9
puts "`class` and `style` in every form" in M1. ADR-0032 left static `style` as the React target's
own UF1002 "until M4's style attribute kind makes it an invariant". Every framework merges and
orders class and style differently, and probes found the obvious mappings broken:

- **Class.** Svelte's `class:name` directive and Angular's `[class.name]` remove a token that a
  dynamic class string produces, instead of joining it. Angular's `[class.w-1.5]` loses the text
  after the dot, its `[class]` array drops entries that hold a space, and it renders a repeated
  token once where the others render it twice. React's `className` and Solid's `class` take only a
  string.
- **Style.** Svelte renders `style={{…}}` as `[object Object]`. Svelte and Angular apply a static
  `style` before the bound declarations, whatever the source order, so a shorthand and its longhand
  override each other differently. Qwik adds `px` to numbers on properties React treats as unitless
  (`strokeWidth`). Solid wants kebab-case keys.
- **Empty values** render differently even within one framework (ADR-0044).

## Decision

- **`class`.** `class="a b"` stays Static. `class={…}` becomes a **Class** attribute of items:
  - a string literal is a Static item; an expression whose kinds are within string, nullish and
    unknown is a Dynamic item, its whitespace-separated tokens;
  - an array literal contributes its elements, recursively; `cond && "a b"` is one Toggle per name;
    `cond ? "a" : "b"` is Dynamic; `false`, `null`, `undefined` and empty strings are dropped;
  - an object literal is one Toggle per name per key, a `true` value a Static name and a `false`
    one nothing (computed keys, spreads and methods: UF3022; an array spread: UF3022; a hole:
    UF1002);
  - `cond && expr` with a non-literal `expr` is UF3018, with a safe fix to `cond ? expr : undefined`
    where `expr` can only be a string; number and boolean kinds in a Dynamic position are UF3018;
  - a Class whose items are all Static, and `class={"a b"}`, is UF3004 with a safe fix to
    `class="a b"` (P3), withheld when a name holds `"` or `&`; a class with no names at all
    (`class=""`, `class={[]}`, `class={{}}`, `class={false}`) is UF3004 with a safe fix that removes
    it; two Static or Toggle items with the same name are UF3007;
  - a static `class="a b a"` that names a class twice is UF3007 too, with a safe fix that lists
    each name once: Angular merges a static class with a bound one (a spread's) through the class
    list, which drops the repeat the other targets keep;
  - a name holding whitespace other than ASCII's (a no-break space) is UF3008: Angular splits names
    there.
- **Class semantics.** The rendered tokens are the union of the Static names, the true Toggles and
  the Dynamic tokens; a nullish or `""` Dynamic value adds none. Order and spacing do not matter,
  and a class with no tokens is the same as no `class` attribute (ADR-0044). A Dynamic token that
  repeats another item's name at run time is outside the contract (ADR-0035), because Angular
  renders it once.
- **`style`.** Every `style` becomes a **Style** attribute of declarations, so ADR-0032's static
  `style` exception ends:
  - `style="color: red; margin-top: 4px"` is split into declarations by `@unframework/parser`
    (outside strings, comments and brackets) and checked by lightningcss: property in lower case,
    value as written, trimmed. A parse error is UF3022;
  - `style={{ color: "red", marginTop: gap, "--gap": size }}`: keys are camelCase standard
    properties or quoted custom properties. A kebab-case standard key is UF3004 with a safe fix to
    camelCase, unless the rename would set a property twice; computed keys, spreads and methods are
    UF3022. String literal values, and template literals without expressions, are Static; other
    values are Bound;
  - a style that sets nothing (`style=""`, `style={{}}`) is UF3022, with a safe fix that removes it;
  - every property is a property Chromium 153 knows (`CSS_PROPERTIES` in `@unframework/ir`, from
    its CSSOM), or a custom property: an unknown name is UF3022 with the help "Did you mean …?" for
    a property at most two edits away. It is almost always a typo, which no browser applies and
    `solid/style-prop` rejects;
  - a static value is one CSS value: not empty, trimmed, with no `;` or `!` outside strings,
    comments and brackets, which are balanced (`cssValueProblem`); `!important` is UF3022;
  - Angular's compiler and its server DOM parse a style again, and read some values and names
    otherwise than CSS, which no binding can avoid. So a static value Angular's style parser
    misreads is UF3022: it knows neither escapes nor comments, ends a string at a quote of its kind
    even when escaped, and counts the parentheses inside strings, so the value must hold no `;`
    that ends it and end outside its strings and parentheses (`content: "a\";b"`,
    `content: "("`). A custom property with an upper-case letter is UF3022 too, as Angular
    lowercases it (`--Gap` becomes `--gap`, which `var(--Gap)` does not find), with the help to
    write it in lower case. `angularMisreads` and `angularLowercases` in `@unframework/ir` decide
    both, for the analyzer and the invariants;
  - one Style that sets a property twice, or two declarations that overlap, is UF3022: the
    object-based targets cannot express it, and order would then matter. Overlap is
    `cssPropertiesOverlap` in `@unframework/ir`: a shorthand and one of its longhands, two
    shorthands that share one, `all` with anything but `direction`, `unicode-bidi` and custom
    properties, or a flow-relative property and a physical one the writing mode can make the same
    (`marginInlineStart` and `marginLeft`). The shorthand table, `CSS_SHORTHANDS`, is Chromium 153's
    CSSOM expansion. The analyzer, the invariants and the normaliser (ADR-0044) read this one copy;
  - a number is accepted only on `UNITLESS_PROPERTIES` (`@unframework/ir`: the standard properties
    both react-dom's and Qwik's unitless lists hold, minus the old flexbox `box-flex*` and
    `line-clamp`, which Chromium knows only prefixed) and on custom properties; elsewhere it is
    UF3018, whose message names the targets that add `px`. A number literal gets a likely fix:
    `"<n>"` on SVG's eight stroke and opacity properties (`stroke-width`, `stroke-opacity`,
    `fill-opacity`, …), where react-dom writes a bare number and only Qwik adds `px`, and `"<n>px"`
    elsewhere, where both do. A literal `0` there is no UF3018 but the static value `0`
    (`margin: 0`), as React and Qwik leave a 0 bare. A boolean kind is UF3018.
- **Style semantics.** A Bound declaration whose value is nullish or `""` is left out, and the
  others render. Their order does not matter, because no two overlap, and a style with no
  declarations is the same as no `style` attribute (ADR-0044).
- **Each target writes its own form** (plan §6):
  - React: `className="…"` when static, otherwise `className={cx(…)}`, even for one dynamic part,
    with an inline `cx` helper printed after the component (`class-binding: emulated`, ADR-0015).
    `cx` is variadic, takes strings and objects of toggles, returns `""` when nothing is on, and
    the toggles print as an object with shorthand keys, one key per name. Style objects, a static
    style string included, with `as CSSProperties` and a type import when a custom property is
    present;
  - Solid: `class="…"` with `classList={{ … }}` for toggles when there is no dynamic part, a toggle
    condition that may not be a boolean in `Boolean(…)`; a lone string part as the class itself
    (``class={`tone-${props.tone}`}``); anything else through the same inline `cx`
    (`class-binding: emulated`, helper `cx`), because a `classList` beside a dynamic `class` loses
    its toggles when the class changes. Style objects with kebab-case keys, number literals as
    strings (`"line-height": "1.5"`, as `solid/style-prop` asks);
  - Vue: the static names as `class="…"` beside one `:class`, which is a lone dynamic value, the
    toggles' object or an array; a static `style="…"` beside `:style="{…}"` for the bound
    declarations. Vue's compiler parses a static `style` again (`parseStringStyle`), which splits
    at a `;` inside a string, drops comments and joins a value whose first parenthesis is `)` to
    the declaration before it, so a static declaration it would misread goes into the `:style`
    object, as a string it takes whole;
  - Svelte: one `class={…}` (clsx): a lone value, the toggles' object, or an array; never `class:`
    directives. A static `style="…"` only when every declaration is Static, otherwise every
    declaration as a `style:` directive in source order (`style:color` when the value is the
    variable of that name). Svelte's server renders every `style:` directive through its runtime,
    which escapes its text a second time and folds its whitespace, so a static directive value
    holding `&`, `<`, `"` or whitespace Svelte folds is a string expression
    (`style:font-family={"…"}`), and so is a static `style` value with such whitespace;
  - Angular: the static names as `class="…"`, then one `[class]`: the toggles' object, the lone
    dynamic value, or `[a, c ? 'x' : null].join(' ')`; never `[class.name]`, and never an array as
    the bound value. A static `style` beside one `[style.prop]` binding per bound declaration,
    custom properties included;
  - Qwik: a lone dynamic part as itself (`class={tone}`), the toggles alone as one object, anything
    else as an array, with the toggles of one source entry joined back into one key
    (`"is-busy button-waiting": busy`) and a condition whose type the target cannot see in
    `Boolean(…)`, as Qwik's types take only primitives there. Style objects with camelCase keys;
  - Astro: `class:list={[…]}`, always an array, for any class with a binding
    (`astro/prefer-class-list-directive`), and `style={{…}}` with camelCase keys and quoted custom
    properties for a style with a binding; the static forms otherwise.
- **Deferred to M4**, each UF1002 with a message that names M4: `style={expr}` that is not an
  object literal (a style string or object from a prop); a class part that holds an array or an
  object at run time (a prop typed `string[]`); vendor-prefixed properties, which the targets
  prefix differently; and a static `display` value that makes a table-internal box, which the
  HTML parser and the targets lay out differently outside a table. A bound `display` is accepted;
  the normaliser models the table-internal boxes it can make (ADR-0044's addendum). The plan's
  "every form" for M1 is narrowed to the literal forms above.
- **Amendments to ADR-0032.** There is no Static `style` attribute in the IR, and no Bound `class`
  or `style`: every `style` is a Style, whose properties are lower case or custom, are in
  `CSS_PROPERTIES` or custom, have no upper-case letter, never repeat or overlap, and whose static
  values are single CSS values that Angular's style parser reads alike. Class items are canonical:
  Static values have single spaces, Toggle names are single tokens, and Static and Toggle names do
  not repeat; nor does a static `class` name a class twice.

```text
Source   <p class={["badge", tone, { active: isActive }]}>          tone: string
React    <p className={cx("badge", tone, { active: isActive })}>
Solid    <p class={cx("badge", props.tone, { active: props.isActive })}>
Vue      <p class="badge" :class="[tone, { active: isActive }]">
Svelte   <p class={["badge", tone, { active: isActive }]}>          (Qwik alike)
Astro    <p class:list={["badge", tone, { active: isActive }]}>
Angular  <p class="badge" [class]="[tone, isActive ? 'active' : null].join(' ')">

Source   <p style={{ marginTop: gap, color: "red" }}>
React    <p style={{ marginTop: gap, color: "red" }}>                (Qwik and Astro alike)
Vue      <p style="color: red" :style="{ marginTop: gap }">
Svelte   <p style:margin-top={gap} style:color="red">
Solid    <p style={{ "margin-top": props.gap, color: "red" }}>
Angular  <p style="color: red" [style.margin-top]="gap">
```

## Consequences

**Positive:**

- Class and style render the same tokens and declarations on seven targets, from SSR and from the
  client, including after a rerender (ADR-0043).
- Each target uses its own idiom; only React and Solid carry a helper, and Solid only when a class
  has a dynamic part beside other parts.
- A misspelt property is caught at the source, with the property it most likely meant.

**Negative:**

- The M1 forms are narrower than plan §4.3: no style strings or objects from props, no class
  arrays from props, no shorthand beside its longhand, no `!important`, no vendor prefixes.
- Authors cannot rely on a class token appearing twice, or on declaration order for the cascade
  inside one `style`.
- `UNITLESS_PROPERTIES` is the intersection of two frameworks' lists, so `strokeWidth: 2` needs a
  string.
- `CSS_PROPERTIES`, `CSS_SHORTHANDS` and `UNITLESS_PROPERTIES` are kept by hand from Chromium 153,
  react-dom and Qwik; a browser that adds a property needs a table change.

**Open:**

- M4 lands the deferred forms with stylesheets, scoped CSS and computed-style parity.

## Alternatives considered

- **Svelte `class:` and Angular `[class.name]` for Toggles.** The idiomatic spelling of a toggle,
  but each removes a token a Dynamic item produced, and Angular's breaks on names with a dot.
- **Keep declaration order significant and print declarations in source order everywhere.** Svelte
  and Angular apply a static `style` first, and every client appends a re-set declaration at the
  end of the CSSOM, so no target can keep source order after a rerender.
- **React's unitless list.** Qwik then renders `stroke-width:2px` and `fill-opacity:2px`, which the
  normaliser cannot equate with React's output.
- **One class string for every target.** Correct, but not idiomatic on Vue, Svelte, Qwik or Astro,
  whose class arrays are their native merge (G2).
- **Solid's `classList` for every toggle, beside a dynamic `class`.** Solid's `class` replaces the
  attribute when it changes, and the toggles `classList` set are lost, so a helper joins them.
- **lightningcss's knowledge of shorthands, as first planned.** The tables follow the browser the
  tests run instead: Chromium's CSSOM decides which longhands a shorthand sets, legacy aliases
  included, and so which order matters in the DOM L7 and L10 compare. A table in
  `@unframework/ir` is also one copy that the analyzer, the invariants and the normaliser share.
- **Accept unknown property names, as syntax only.** The targets would all copy a typo, and
  Solid's lint would reject it on one target only (P4).

## Evidence

- Svelte 5.57.1: `<p class={c} class:b={on}>` with `c = "b x"` and `on` false renders `class="x"`.
  Angular 22.2.1: `<p [class]="c()" [class.b]="on()">` renders `class="x"`; `[class.w-1.5]` renders
  `w-1`; `[class]="[c(), 'z']"` with `c = "a b"` renders only `z`; `class="a" [class]="'a'"` renders
  `a` once. Vue's `:class="[c, { b: on }]"` renders `b x`, and Astro's `class:list` keeps repeated
  tokens.
- Svelte `style="margin-top: 4px" style:margin={m}` renders `margin-top: 4px; margin: 0;`, and
  directives alone keep their written order. Angular applies its static `style` first and keeps
  `[style.*]` bindings in template order. Svelte drops a static declaration that a nullish
  directive also names.
- react-dom 19.3's unitless list has `strokeWidth`, `fillOpacity`, `strokeOpacity` and
  `strokeDasharray`, which Qwik 2.0.0-beta.47's lacks: `strokeWidth: 2` renders
  `stroke-width:2px` on Qwik where Vue and React render `stroke-width:2`. `UNITLESS_PROPERTIES` is
  the two lists' standard properties in common, less the four named above.
- tsgo: React custom properties type-check only with `as CSSProperties`
  (`packages/target-react/test/emit.test.ts`, "writes a style as an object, typed as CSSProperties
  when it sets a custom property"); Qwik's class array `["a", n && "b"]` with a number `n` fails
  TS2322, so Toggles print as object entries.
- The markup cases (`packages/codegen/test/markup-cases.ts`) render each class and style form
  through Vue, Svelte, Astro and Angular themselves (each target's `markup-semantics.test.ts`):
  "toggles, with names that are not identifiers" (`w-1.5`), "a nullish or empty dynamic class",
  "a bound declaration before a static one" and "nullish and empty declarations are left out".
  The render-parity kit renders every class and style form of its tricky and seeded components on
  all seven targets against the reference evaluator.
- `packages/analyzer/test/bindings.test.ts` holds the class and style rules, among them "reports the
  unknown property in %s (UF3022)", "reports the upper-case custom property in %s (UF3022)",
  "reports a value Angular's style parser misreads: %s (UF3022)", "names the milestone that lands
  %s" and "says which targets add `px` to %s, and fixes it as React renders it" and "takes a literal
  0 on any property as the static value 0"; its `attributes.test.ts` "reports the class named twice
  in %s, and the fix lists it once"; `packages/ir/test/invariants.test.ts` breaks each amendment
  once ("a static style", "a bound class", "static class names that are not canonical", "a toggle of
  two names", "a class named twice", a static `class "a b a"`, "a shorthand and its longhand", "a
  custom property with an upper-case letter", "a value with an escaped quote of its own kind", "a
  parenthesis in a string", "a quote in a comment").
- Svelte's server and `style:` directives: `packages/target-svelte/test/emit.test.ts` "writes
  static text Svelte's server would escape twice or fold as expressions"; the kit's source "static
  declarations with quotes, an ampersand and a `<` beside a bound one" renders on all seven
  targets.
- Vue's re-parsing of a static `style`: `packages/codegen/test/markup.test.ts` "binds a static
  declaration Vue's style parser would misread" (and, for Angular, "refuses a declaration
  Angular's style parser misreads: %s"); `packages/target-vue/test/emit.test.ts` "binds the static
  declarations Vue's style parser would misread" and `test/render.test.ts` "renders static
  declarations its style parser would misread"; the kit's source "static style values that Vue's
  style parser misreads" renders on all seven targets.
  `packages/target-qwik/test/emit.test.ts` "writes a condition whose type it cannot see as
  `Boolean(…)`".
- The `bindings/class-*` and `bindings/style-*` cases are green at every live layer on all seven
  targets. Solid's goldens show both of its forms: `classList` in `class-object`, `cx` in
  `class-array`, `class-merge` and `class-string`.
