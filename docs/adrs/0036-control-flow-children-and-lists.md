# ADR-0036: Conditionals test truthiness, lists need one keyed element, and children lower by shape

- **Status:** Accepted
- **Date:** 2026-10-05
- **Plan:** §4.3, §4.5 (Keyed lists), §4.6, §5.3, §5.4, §6, §9 M1; P2, P3, P4; R4; amends
  ADR-0002 and ADR-0032

## Context

ADR-0002 makes control flow plain JS, lowered from expression shape: "a conditional or logical
expression whose branches yield JSX becomes an `If`", a `.map` whose callback returns JSX becomes a
`For`, and every other expression stays an `Interpolation`. M1 lowers all three on seven targets,
and two parts of that rule do not survive contact with them:

- **`&&` by JavaScript's value is not portable.** `{count && <b>items</b>}` renders `0` on React,
  Solid and Astro when `count` is 0, and nothing on Vue, whose `v-if` tests truthiness. Under
  ADR-0002, `{count && "items"}` (no JSX) is an Interpolation that renders `0` everywhere.
- **`||` and `??` with a JSX branch have no template form.** `{label || <em>none</em>}` renders the
  left value when it is truthy, which `v-if`, `{#if}` and `@if` cannot express without repeating it.

The children, branches and list bodies also need rules the plan leaves open: what a literal child
renders, how text runs merge, which empty branches survive, where text may sit, and what a key
may read.

## Decision

`lowerChild(expression)` returns render nodes, recursively:

| Child                                          | Lowers to                                                  |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `{/* c */}`, `{null}`, `{undefined}`, `{""}`   | nothing                                                    |
| `{true}`, `{false}`                            | nothing, and UF3016: always a mistake                      |
| a string literal, a template literal, no `${}` | **Text**                                                   |
| `{<el />}`                                     | the element                                                |
| `c && X`, whatever `X` is                      | **If**: one branch, `c` and `lowerChild(X)`                |
| `c ? X : Y`, with JSX anywhere in `X` or `Y`   | an **If** chain; a `?:` or `&&` with JSX in `Y` extends it |
| `c ? "a" : "b"`, with no JSX                   | **Interpolation**                                          |
| `src.map((item, index) => <el key={k} />)`     | **For**                                                    |
| `<>…</>`                                       | its children, flattened into the parent                    |
| any other expression                           | **Interpolation**, rendered as ADR-0037 says               |

- **Conditions test truthiness, as `v-if` does** (amends ADR-0002). Every `c && X` is an If,
  whether or not `X` holds JSX, so `0 && …` renders nothing on every target. A conditional in a
  branch's consequent nests an If; only the alternate extends the chain.
- **`x || <B/>` and `x ?? <B/>` are UF3025 `unsupported-conditional`** (amends ADR-0002) when either
  side holds JSX. The help writes the conditional with `?:`: `value ? value : <p>None</p>` for
  `||`, and `value != null ? value : <p>None</p>` for `??`, which renders `0` and `""` as `??`
  does. Where the left side is a plain reference rendered as text (a string or a number that may
  be nullish) and nothing but the operator lies between the sides, a safe fix writes that form.
  Both sides are still analysed.
- **After lowering, adjacent Texts merge** into one Text spanning the run (`a{null}b`, `a<></>b`,
  ``{"a"}{`b`}c``). An If whose branches all render nothing is dropped (`a{on && null}b` is the text
  `ab`), and so is every trailing branch that renders nothing, an else or not. A leading or middle
  empty branch stays in the IR, and each target prints what its idiom needs (below).
- **Placement looks through control flow.** The nesting tables (`REQUIRED_PARENTS`,
  `PERMITTED_CHILDREN`, `TEXT_ONLY_ELEMENTS`, `TEXTLESS_ELEMENTS` in `@unframework/ir`) see through
  If, For and fragments, so `<table>{rows.map((r) => <tr key={r.id}>…</tr>)}</table>` is UF3003,
  with the help to write the `<tbody>`. An Interpolation, or an If with a branch of text, is UF3003
  inside a textless element, `select` or `datalist`, and in SVG outside the text elements
  (ADR-0040); whitespace-only text there is UF3003 with a safe removal fix. Inside `textarea` only
  static text is accepted: its content is its value, which is form state, so an expression or a
  conditional there is UF1002 until M3, and a list's element is UF3003. The HTML parser reads an
  `<iframe>`'s content as raw text, decoding no reference and reading no comment, so the servers'
  escapes and comment anchors would show as text, and a browser never shows it: text other than
  whitespace, an expression or a conditional there is UF3003, with the help to remove it.
- **A leading line feed** in the first text of `pre`, `textarea` or `listing`, or of a branch that
  starts one, is UF3017 `dropped-line-feed`. So is one after a conditional or a list that can
  render nothing (a list, a conditional without an else, or one with a branch that can be
  empty): React's and Astro's servers then write nothing before the text, and the parser drops its
  line feed, where the other targets write a comment first. A child that was reported keeps its
  place in this reading, so a fix reveals nothing new.
- **The root** is an element or a fragment. A returned conditional or `.map` is UF1102 with a
  likely fix that wraps it in `<>{…}</>`; its content is still analysed, so the fix reveals nothing
  new. A root fragment that renders nothing (`<></>`, `<>{null}</>`) is UF1102 too. Each root of a
  fragment is a component root for the nesting tables (ADR-0010 for Angular).
- **Lists.** In child position, `source.map(callback)` takes one arrow with one or two plain
  identifier parameters (`item`, optional `index`) whose body is one JSX element, as an expression
  or as a block that only returns it (the targets print the expression form). A pattern, a default,
  an optional or a third parameter, a fragment or conditional body, or a function expression is
  UF3015 `invalid-list`, which names the canonical form. A conditional body has no fix: the help
  filters the list first for an item that renders or not, and for an item that renders one element
  or another moves the conditional into one keyed element that every item renders
  (`<li key={item.id}>{item.href ? <a href={item.href}>…</a> : <span>…</span>}</li>`). For a
  destructured item, the help names the item and reads its parts as `item.name`, or as `entry[0]`
  and `entry[1]` for an array pattern (`Object.entries`); an annotated parameter or an `async` arrow
  is UF1002. A `.map` whose callback returns no JSX is an expression, and UF3016 for its array kind.
  The source's value kinds must be within array and unknown (UF3018, whose help for an optional prop
  is `(items ?? []).map(…)` or the default `[]`), where it is read: a condition that narrows it on
  every target narrows it here too (`{box.items && box.items.map(…)}`, ADR-0035), and one the
  targets' checkers read apart is UF1002. `source?.map(…)` is not a list: `?.` on a source that is
  never nullish there is UF3023, with a safe fix to `.`, and on one that may be nullish UF3018, with
  a safe fix to `(source ?? []).map(…)`, which renders alike on every target. A `?.` inside the
  source (`maybe?.slice(0, 2).map(…)`) ends the whole chain, `.map` included, so React, Qwik and
  Astro would call `.map` on `undefined` where the others render an empty list: UF3018, with the
  same fix around the source. `.map?.(…)` is UF3023, as an array's `map` is always there.
- **Keys.** The body element carries `key={expr}`, lifted into `For.key`:
  - without it, UF3013 `missing-key`, with a likely fix `key={index}` that reuses the index
    parameter or adds one under a free name (`index`, `index2`, …);
  - `key` anywhere else, inside a list's element or a conditional included, is UF3014
    `misplaced-key` with a safe removal fix; a constant `key` on a list's element is UF3014 too,
    with UF3013's index fix, because it gives every item the same key;
  - only JSX's `key`, in lower case, keys an element: `KEY={…}` or `Key={…}` on a list's element is
    UF3004 with a safe rename to `key`, and a second key in any case on one element is UF3007;
  - the key's kinds must be within string, number and unknown (UF3018);
  - the key must read the item or the index (UF3018): one that reads neither is the same for every
    item, which Vue's and Svelte's compilers reject;
  - the key reads no variable of an enclosing list (UF3018): it identifies the item within its own
    list, and Angular's `track` reads only its own item, `$index` and the component's members
    (NG8009). A key may read a prop: Angular reads it there as `this.name()`, from its input, which
    its checker never narrows, so a key's use of a prop a condition narrows that relies on the
    narrowing (a member read through `.`, arithmetic, a call's argument: `key={count + i}`) is
    UF1002, whose help gives forms that compile (`(count ?? 0) + index`, `label?.length ?? 0`).
    `?.`, `??`, a test, an equality and a string (``key={`${count}-${i}`}``) are accepted there
    (ADR-0035). A list inside a conditional child's branch may read a destructured prop the
    condition narrows through `.` outside its key.
- **Amendments to ADR-0032.** The invariants hold the shapes the targets print: conditionals,
  lists and fragments as above, never two texts side by side, a list's key that reads its own
  item or index and no variable of a list around it, no text but whitespace, interpolation or
  conditional in an `<iframe>`, and no line feed the parser drops at the start of a `pre`, after
  what may render nothing included.
- **M1 guarantees a list's content and order only.** Plan §4.5's "Keyed lists" rule, that a
  reorder keeps DOM identity, arrives later with its own capability and `semantics/keyed-lists`
  case; no spec asserts identity until then. Keys must be unique at run time (ADR-0035).
- **Each target writes its own construct** (plan §6). The capabilities `interpolation`,
  `conditional`, `list` and `fragment` are native on all seven.

```text
Source   {unread && <p>{unread} unread</p>}
React    {unread ? <p>{unread} unread</p> : null}               (Qwik and Astro alike)
Vue      <p v-if="unread">{{ unread }} unread</p>
Svelte   {#if unread}<p>{unread} unread</p>{/if}
Solid    <Show keyed when={props.unread}>{(unread) => <p>{unread} unread</p>}</Show>
Angular  @if (unread) {<p>{{ unread }} unread</p>}                (after @let unread = this.unread();)

Source   {contributors.map((contributor) => <tr key={contributor.login}>…</tr>)}
React    {contributors.map((contributor) => <tr key={contributor.login}>…</tr>)}   (Qwik alike)
Astro    {contributors.map((contributor) => <tr>…</tr>)}
Vue      <tr v-for="contributor in contributors" :key="contributor.login">…</tr>
Svelte   {#each contributors as contributor (contributor.login)}<tr>…</tr>{/each}
Solid    <For each={props.contributors}>{(contributor) => <tr>…</tr>}</For>
Angular  @for (contributor of contributors; track contributor.login) {<tr>…</tr>}
         @for (step of steps; track index; let index = $index) {…}      (an indexed list)
```

- **Conditionals per target.**
  - React, Qwik and Astro write ternary chains that end in the else branch, or in `null`, never in
    `&&`; an empty branch prints `null` in its place. Astro writes a branch that is not one element
    or one text as a fragment.
  - Vue puts `v-if`, `v-else-if` and `v-else` on a single-element branch and on a `<template>`
    otherwise, and never puts `v-if` and `v-for` on one element.
  - Vue, Svelte and Angular have no empty branch: an empty branch is left out, and its negation is
    joined into every later condition (`c ? null : <B/>` is `v-if="!c"`, `{#if !c}`, `@if (!c)`).
    Angular's `no-empty-control-flow` rule rejects `@if (c) {}` (ADR-0042).
  - Solid writes `<Show when={c} fallback={…}>`, `<Show when={!c}>` when only the else branch
    renders (`<Show when={c}>` for `!c ? null : …`), and `<Switch>` and `<Match>` for a longer
    chain, with `{null}` for an empty branch.
  - Solid's `<Show>` and `<Match>` children are no branch of their condition to TypeScript, so a
    branch that reads what its tests narrow would fail L4 where the source type-checks
    (`props.user.name` where `props.user` may be absent: TS18048). So a branch that reads a
    binding its tests mention (the tests that hold or fail where it renders) takes the values it
    reads from a keyed callback, as plain values that TypeScript narrows where the `when` builds
    them (`narrowing.ts` in the Solid target). The rule is syntactic: a value taken where none
    needed narrowing renders alike, so the target reads no types to decide it. A branch that reads
    nothing its tests mention keeps plain children.
  - **One test, one value.** Where the branch shows when its one test holds, and that test is
    exactly the path the branch reads through, the `when` is the test and the callback receives
    its value: `<Show keyed when={props.user}>{(user) => <p>{user.name}</p>}</Show>`. Solid types
    the value `NonNullable<T>`, which keeps the falsy literals (`""`, `0`, `false`) that the test
    removes. So where the props' types hold one, the `when` is `props.limit || undefined`, which
    TypeScript narrows as the test does. The types are read from their text, conservatively: a
    `0`, a `false` or an empty quote anywhere counts, and `boolean` does not, as a branch reads a
    tested boolean as a boolean.
  - **An object of the paths.** Otherwise the `when` builds, inside the source's own condition, an
    object of what the branch reads, and the callback destructures it:
    `<Show keyed when={props.count !== undefined ? { count: props.count } : undefined}>`, then
    `{({ count }) => <b>{count.toFixed(1)}</b>}`. For each read, the branch carries the longest
    prefix that its tests have read wherever it renders, every object on the way present: `res` for
    `res.value` under `res.ok`, but only `box.inner` of `box.inner?.title` in the else of
    `box.inner && box.inner.title.length > 3`, where `box.inner` may be absent. So the `when` reads
    nothing the source might not, and the rest of the read stays as the source writes it
    (`inner?.title`). The object is truthy where the test holds, so the branch shows as before.
    Comparisons, `typeof`, discriminants, `?.` and tests joined by `&&` take this form
    (`props.label && props.user ? { user: props.user } : undefined`). A `typeof` test against
    `"undefined"` that comes out unequal (`typeof box.inner?.other !== "undefined"`) reads its
    chain to its end, so the branch takes `other`. A computed key written as a template literal
    without `${}` is a property (``user[`nick`]``). A path that a callback around the branch
    already carries at more length is not taken again: its parameter would go unread, which L5
    rejects.
  - **Elses and chains.** An else, or a later branch of a chain, that reads what its tests mention
    is a keyed `<Match>` whose `when` is the source's chain up to it, the failed tests leaving
    nothing:
    `typeof props.value === "string" ? undefined : props.value !== null ? { value: props.value } : undefined`.
    TypeScript narrows it by every failed test, and `<Match>` evaluates it only where those before
    it failed. A branch that needs nothing stays a plain `<Match when>` or the `<Switch>`'s
    fallback. A negated test's else (`!user ? A : B`) is
    `<Show keyed when={props.user} fallback={A}>`.
  - **Names.** Each value is named after its binding or its last property (`value` for one no
    target can declare, such as `class`). Where that would capture a name the output prints as it
    is (a list's variable, an arrow's parameter, a global, the object form's parameter), an import,
    a helper or another value of a callback around it, the value takes a free name from the file's
    name scope (`user_1`). A list's item taken whole keeps its name
    (`<Show keyed when={row}>{(row) => …}`), as every read of it inside is the narrowed value. A
    method the branch calls keeps its object (`label.trim()` takes `label`), whose `this` the
    method alone would lose.
  - **Inside the branch, the code is the source's**, with plain names that TypeScript narrows as it
    narrows the source's, in nested conditionals, lists and arrow functions too: inside the user's
    callback, `user.age !== undefined ? user.age.toFixed() : "-"` stays as it is. Solid calls a
    function child untracked, so a branch that is one interpolation is a fragment, which Solid
    compiles to a memo and which keeps its reads tracked:
    `{(user) => <>{user.name + props.label}</>}` updates when only the label changes.
  - **Keyed, a branch renders again whenever its value changes** (another user, or a new
    `{ count }` when `count` changes), where plain children would update in place. M1 has no state
    to lose, and M2 must revisit it for focus and component state. In exchange, a value the
    callback received never goes stale: Solid disposes a keyed branch before anything inside it
    can read a value its test no longer guards, while the memos that dom-expressions compiles for a
    nested conditional over an accessor can run after the guard has flipped. `solid/prefer-show`
    stays on.
- **Lists per target.** An index nothing reads is left out on all seven. Solid's `<For>` takes no
  key, and an index becomes `index()`; Astro drops `key`, which it would render as an attribute. So
  Solid and Astro also leave out an index, or an item, that only the key reads.
- **Text the targets would lose is written as an expression.**
  - Angular's template parser drops a text node that `trim()` empties right after an `@if` or
    `@for` block, while it looks for the block's `@else` or `@empty`, a no-break space and `&ngsp;`
    included, even in `<pre>`. The Angular dialect writes such text as an interpolated literal,
    `{{ " " }}`.
  - Text at the outer edges of a root fragment is protected from the printer's own line breaks:
    Vue writes it as `{{ "…" }}`, Angular inside `<ng-container>`, and Astro as `{"…"}`, which
    also keeps root text that starts with `---` out of the frontmatter's fence.
  - Svelte keeps whitespace between a block and its siblings, so the printer glues a block's close
    to the next sibling (`{/if}{#if …}`, `</ul\n  >{#if …}`).
- **Solid's three rewrites** keep the output what Solid's tools expect, with the same DOM:
  - an interpolated conditional whose branch prints as a bare name (a list's item, `undefined`, or a
    value a keyed callback received) is a `<Show>`, as `solid/prefer-show` asks:
    `{done ? title : "-"}` becomes `<Show when={done} fallback={"-"}>{title}</Show>`;
  - Solid compiles static content into an HTML template, where the browser drops a line feed right
    after `<pre>`; a line feed that would start a `<pre>`'s template after expressions is written
    `{["\n"]}`;
  - Solid's server compiler writes the string literals it finds inside a conditional, a `+`, the
    right of `&&` or a child's template literal into the HTML unescaped; such a literal holding
    `<` or `&` (`"` or `&` in an attribute) is wrapped in `String(…)`, the same string, which it
    escapes.

## Consequences

**Positive:**

- `&&` means one thing on seven targets, and it is what template authors expect.
- Every construct either lowers to each target's native control flow or fails with a code that
  names the canonical form.
- Keys that every framework accepts are the only keys an author can write.

**Negative:**

- `{count && "items"}` no longer renders `0`, which a React author may expect. The source's meaning
  is Vue's (ADR-0014).
- Authors used to `x || <Fallback />`, `.map` over fragments, conditional list items or keys built
  from an outer item have to rewrite them.
- Keyed lists are not yet the identity guarantee plan §4.5 promises: Solid keys by item reference,
  and Astro has no client.
- On Solid, a branch that reads what its tests narrow renders again when its value changes, where
  plain children would update in place.

**Open:**

- The keyed-lists capability and its case: Solid and Astro will not be native.
- M3: lists of components, and slot content inside `.map`.
- M2: whether Solid's keyed branches lose focus or component state, and what replaces them there.

## Alternatives considered

- **Keep JavaScript's value semantics for `&&`.** React, Solid and Astro would stay as written, but
  the template targets would have to print the falsy value in an else branch, minus `false`, `null`
  and `undefined`, which no template author writes (G2). The source's meaning would no longer be
  Vue's `v-if` (ADR-0014).
- **Lower `x || <B/>` as `x ? x : <B/>`, or offer that as a fix.** The compiler would evaluate `x`
  twice behind the author's back, and add a second spelling of a conditional (P3). The help shows
  the ternary, and the author writes it, choosing which value renders.
- **Accept a fragment or a conditional as a list body.** The key would need React's and Qwik's
  named `Fragment`, and Solid's `<For>` takes none; one element keeps one place for it.
  `.filter()` before `.map()` says the same as a conditional body.
- **Infer a key when the source omits it.** It hides the author's choice of identity, and React and
  Vue warn at run time without one.
- **Print an empty branch on every target.** Angular's lint rejects an empty `@if {}`, and Vue and
  Svelte have no empty-branch spelling that reads as idiomatic; folding the negation into the
  later conditions renders the same.
- **Solid's accessor callbacks, with a narrowed object where no callback carries the narrowing.**
  M1's first design: `<Show when={props.user}>{(user) => <p>{user().name}</p>}</Show>`, which
  updates the branch in place. TypeScript does not narrow a call, so a test inside the branch's own
  expressions (`user().age !== undefined ? user().age.toFixed() : "-"`) failed L4; the form was
  chosen by reading declared types from their source text, which a comment could mislead; and a
  nested conditional's memo could read an accessor after its guard had flipped. The fix wave's
  review found the first two with sources the analyzer accepts.
- **Keep emitters from splitting text runs.** How a framework splits text into DOM nodes is its
  own noise; L10 captures merged runs instead (ADR-0044's addendum).

## Evidence

- React 19.3 and Solid 1.9.15 render `{0 && <b/>}` as `0`; Vue 3.5.43's `v-if` renders nothing;
  Astro renders `0`. Vue renders a literal `{true}` child as `true`, React and Solid render
  nothing. No output uses `&&`: `packages/codegen/test/jsx.test.ts` "prints conditionals as
  ternary chains ending in null, never `&&`", and `control-flow/logical-and`'s `all-falsy`
  scenario (`0` and `""`) renders nothing on all seven targets.
- Without children, Solid's `<Show when={c} fallback={…} />` and `<Match when={c} />` fail tsgo
  with TS2769.
- Vue renders `<template v-if>` inside `<textarea>` as literal text, and Svelte refuses `{#if}`
  there. Svelte's client sets an interpolated textarea's value property instead of its text, so its
  DOM differs from Vue's.
- Duplicate keys: Svelte's client throws `each_key_duplicate`, React logs an error and Angular warns
  NG0955; Solid and Astro accept them. Sparse arrays: Svelte's server renders a hole as
  `undefined`, Vue and Angular iterate holes, `.map` skips them. The kit's reference evaluator
  refuses both (`packages/codegen/test/render-parity-reference.test.ts`, "refuses %s").
- Angular 22 compiles `@for (step of steps; track index; let index = $index)` without a warning
  (`packages/target-angular/test/emit.test.ts`, "reads a prop in a list's key from its input, and
  declares the index the key reads"; `test/output.test.ts`, where ngtsc's warnings fail). Astro
  renders `<li key="0">` when `key` is kept.
- `packages/analyzer/test/children.test.ts` and `lists.test.ts` pin the table and the rules: the
  merged texts, the dropped conditionals, UF3025 with both sides checked, placement through
  conditionals, lists and fragments, the leading line feed in a branch, the returned conditional and
  its fix, the list shapes, "reports a constant `key="x"` on a list's element, and keys it by its
  index (UF3014)", a key that reads neither the item nor the index, and "reports a key that reads
  the item of a list around it (UF3018)"; and, from M1's final review, "reports the line feed after
  what renders nothing in %s (UF3017)", "reports the content of %s" (an `<iframe>`'s), "accepts
  whitespace in an <iframe>, which reads alike", "a list read through `?.`" ("reports %s, and the
  fix lowers it") and "a key in another case" ("reports %s (UF3004), and the fix renames it",
  "reports a key set twice on a list's element (UF3007)"). From M1's last sweep: "writes %s as a
  conditional (UF3025)" and "offers no rewrite of %s" in `children.test.ts`, the corpus case
  `diagnostics/unsupported-conditional`, which expects the safe fix, and "helps with the body of %s"
  and "names the parts of an item a callback destructures as an array" in `lists.test.ts`.
  `packages/ir/test/invariants.test.ts` breaks each amendment ("a list keyed by a constant", "a list
  keyed by a prop", "a key that reads a loop variable of a list around it", "a line feed after a
  conditional without an else", "a line feed after a list", "text in an iframe", "a conditional of
  whitespace in an iframe").
- `packages/codegen/test/markup.test.ts` "folds an empty branch into the conditions after it, where
  the language has no empty branch"; `packages/target-solid/test/emit.test.ts` "shows the else
  branch under the negated condition when the first is empty", "writes a longer chain as <Switch>
  and <Match>, an empty branch holding {null}", "writes an interpolated conditional of a bare name
  as <Show> (solid/prefer-show)" and "wraps the literals the server would write unescaped in
  String(…)"; `test/rewrites.browser.test.ts` "keeps every line feed of a <pre> whose lines are
  expressions"; `packages/target-angular/test/emit.test.ts` "writes blank text after a block as an
  interpolated literal". The kit's seeded component 24, read through a props object, found the
  Angular rule; its tricky sources "a leading empty branch" and "a middle empty branch" render on
  all seven targets.
- Solid's keyed callbacks: `packages/target-solid/test/emit.test.ts`, "solid narrowing (TypeScript
  narrows what a condition tests)": "gives a branch the value its one test holds, through a keyed
  callback", "keeps <Show> and <Switch> plain where no branch reads what its tests mention", "builds
  an object of what the branch reads inside the source's own condition", "writes an else and a chain
  that need it as keyed <Match>es repeating the chain", "reads plain values inside the branch,
  nested conditionals and lists included", "takes only what its tests read where it renders, the
  rest of the read as written", "gives a list's callback and an arrow in the branch the plain
  value", "names a value apart from every name it could capture", "takes a method's object, which
  keeps the method's `this`", "keeps a branch of one interpolation tracked, in a fragment", "writes
  `|| undefined` after a test that is the value, where a type has a falsy literal", "reads a chain
  `typeof … !== "undefined"` tests to its end", "takes nothing a callback around it gives at more
  length" and "reads a computed key of a template literal as a property"; `test/output.test.ts`
  "renders the branches that narrow on the server, absent and present", and L3, L4 and L5 over every
  source of `test/sources.ts`, `Narrowing` and `NarrowingForms` among them;
  `test/rewrites.browser.test.ts` "updates the branches that narrow, as their references come and
  go", where a new value renders its branch again, a branch whose value stays still renders a new
  label, and nothing is thrown or logged as the tests flip. Without the callbacks, TypeScript 7
  rejects the branch's reads (TS18048, TS18049) where React and Qwik, which print ternaries,
  type-check.
- The `control-flow/*` cases are green at every live layer on all seven targets.
