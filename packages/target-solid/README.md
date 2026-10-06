# @unframework/target-solid

The Solid 1.9 target of the Unframework compiler: one function component in TSX per source
component, written as a Solid developer would write it (design §5.4).

```tsx
import { Show, mergeProps } from "solid-js";

export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
  count?: number;
}

export default function Badge(rawProps: BadgeProps) {
  const props = mergeProps({ tone: "info" } satisfies Partial<BadgeProps>, rawProps);
  return (
    <span class="badge" data-tone={props.tone}>
      {props.label}
      <Show keyed when={props.count}>
        {(count) => <b>{count}</b>}
      </Show>
    </span>
  );
}
```

- The type declarations the props use, copied as written (exported as in the source). Props
  are never destructured (`solid/no-destructure`): Solid's props object is reactive, and every
  read is `props.label`. Defaults go through `mergeProps`, typed `satisfies Partial<Props>` so
  that literal defaults keep their types; it applies a default when a prop is absent or
  `undefined`, and keeps `null`, as the other targets do. When a default holds an object or an
  array literal, the defaults are a `const defaults: Required<Pick<Props, "attrs">> = { … }` of
  their own instead: `satisfies` would keep the literal's own type, without the optional
  members it leaves out (`{ title: "t" }`) or with only the literals it lists (`["info"]` for
  `Tone[]`), and `mergeProps` would type the prop by both (`tones.includes(tone)` fails). A
  scalar's literal type is a member of its prop's, which `mergeProps` keeps. The object form
  keeps its own name (`card.title`). A prop no expression reads takes no default, and a props object nothing
  reads is `_props` (an object form's name that is `_` and more is kept): unused bindings fail
  L5.
- Expressions exactly as the source writes them, with each prop read through `props`.
  Conditionals are Solid's control flow, which test truthiness as the IR does (`0` renders
  nothing): `<Show when={c} fallback={…}>`, `<Show when={!c}>` when only the else branch
  renders (`<Show when={c}>` for `!c ? null : …`), and `<Switch>`/`<Match>` for a longer chain,
  an empty branch holding `{null}`.
- A branch that reads a binding its tests mention (those that hold or fail where it renders)
  takes the values it reads from a keyed callback, as plain names (`src/narrowing.ts`):
  `<Show>`'s and `<Match>`'s children are no branch of their condition to TypeScript, so
  `props.user.name` there would fail L4. Where the branch's one test is exactly the path it
  reads through, the callback receives that value:
  `<Show keyed when={props.user}>{(user) => <p>{user.name}</p>}</Show>`. Solid types that value
  `NonNullable<T>`, which keeps the falsy literals (`""`, `0`) a truthiness test removes, so
  where the props' types hold one (read from their text, conservatively) the `when` is
  `props.limit || undefined`, which TypeScript narrows as the test does. Otherwise the `when`
  builds, inside the source's own condition, an object of the paths the branch reads,
  destructured by the callback:
  `<Show keyed when={props.count !== undefined ? { count: props.count } : undefined}>{({ count }) => <b>{count.toFixed(1)}</b>}</Show>`.
  Each path is the longest prefix of a read that the tests have read wherever the branch
  renders, every object on the way present: `res` of `res.value.t` when the test is `res.ok`,
  but only `box.inner` of `box.inner?.title` in the else of
  `box.inner && box.inner.title.length > 3`, which may not have read `box.inner.title`. The
  `when` reads it before the branch would, so it reads nothing the source might not, and the
  rest of the read stays as the source writes it (`inner?.title`): TypeScript narrows nothing
  the tests have not read; nor does it take a path a callback around it gives at more length,
  which the read takes from there. The branch's code is the source's, with names TypeScript
  narrows as it narrows the source's, in a list's callback and an arrow too. Solid calls the
  callback untracked, so a branch that is one interpolation is a fragment
  (`{(user) => <>{user.name + props.label}</>}`), which Solid compiles to a memo: the label still
  updates where the user stays. An else or a branch of a chain that does is a keyed `<Match>`
  whose `when` is the source's chain up to it, failed tests leaving nothing
  (`typeof props.value === "string" ? undefined : props.value !== null ? { value: props.value } : undefined`),
  so TypeScript narrows by every failed test and `<Match>` evaluates it only where they failed;
  a branch that needs none stays a plain `<Match when>` or the fallback. A negated test's else
  (`!user ? A : B`) is `<Show keyed when={props.user} fallback={A}>`. Each value is named after
  its binding or last property (`value` for one no target can declare, such as `class`), or a
  free name where that would capture a name the output prints as it is, the object form's
  parameter, an import or helper, or another callback's around it; a list's item taken whole
  keeps its name (`<Show keyed when={row}>{(row) => …}`), as every read of it inside is the
  narrowed value. A method the branch calls keeps its object (`label.trim()` takes `label`). The
  rules are syntactic: a value taken where none was needed renders alike. Keyed, a branch renders
  again whenever its value changes (a new object, or a new `{ count }`), where plain children
  would update in place: M1 has no state to lose, and M2 must revisit it for focus and component
  state. A value the callback received never goes stale, so nothing inside a branch reads what
  its test no longer guards when it flips.
- Lists are `<For each={items}>{(item, index) => <li>…</li>}</For>`. `<For>` keys rows by the
  items themselves, so the source's `key` is not printed (M1 guarantees a list's content and
  order, not its DOM identity); the index is an accessor, `index()`. A parameter nothing reads
  is left out, the key not counting.
- HTML's attribute names as written (`class`, `for`, `tabindex`, `readonly`), which Solid's JSX
  takes; SVG's in their own case (`viewBox`, `stroke-width`). Every bindable boolean attribute
  is one Solid's compiler sets as a boolean, so none needs `bool:` (`test/attributes.test.ts`).
  An attribute Solid's types do not let an element take, although the authoring types do (SVG's
  presentation attributes on gradients, filter primitives and `<stop>`, `direction`, `overflow`
  and `visibility` on most elements, `edgeMode` on `<feGaussianBlur>`, `lengthAdjust` on
  `<textPath>`, `href` on `<mpath>`, `tabindex` on `<dialog>`), is an object spread, which Solid
  renders as written:
  `<stop offset="0" {...{ fill: props.colour }} />`. Alone on its element, or where the types
  forbid it, the object is typed `Record<string, unknown>`, as TypeScript checks it otherwise.
- `class="a b"` for static names, and `classList={{ active: props.active }}` for toggles
  beside them, a condition that may not be a boolean in `Boolean(…)`. A lone string part is the
  class itself (``class={`tone-${props.tone}`}``). Any other class goes through `cx`, an inline
  helper printed after the component (`class={cx("badge", props.tone, { active: props.active })}`):
  Solid's `class` takes one string, and a `classList` beside a dynamic `class` would lose its
  toggles when the class changes. The `class-binding` capability is emulated.
- `style={{ color: "red", "margin-top": props.gap, "--gap": props.size }}`, with kebab-case
  keys and number literals as strings (`"line-height": "1.5"`, which `solid/style-prop` asks
  for); a static style string becomes such an object too.
- A spread written out key by key (`title={props.attrs.title}`, through `?.` when the source
  may be absent), its `class` merged into the element's `cx`: Solid's own spread would let the
  later `class` win (ADR-0039).

Three rewrites keep the output what Solid's tools expect:

- an interpolated conditional whose branch prints as a bare name (a list's item, `undefined`, or
  a value a keyed callback received) is a `<Show>`, as `solid/prefer-show` asks:
  `{done ? title : "-"}` becomes `<Show when={done} fallback={"-"}>{title}</Show>`;
- Solid compiles static content into an HTML template, where the browser drops a line feed
  right after `<pre>`. A line feed that would start a `<pre>`'s template (text after only
  expressions, `<pre>{name}{"\n"}{street}</pre>`) is inserted instead, as `{["\n"]}`;
- Solid's server compiler escapes an expression's value, but writes the string literals it
  finds inside a conditional, a `+`, the right of `&&` or a child's template literal into the
  HTML as they are. Such a literal holding `<` or `&` (`"` or `&` in an attribute) is wrapped in
  `String(…)`, the same string, which it escapes: `{done ? String("<b>") : props.name}`.

Every name the output introduces (`props`, `rawProps`, `_props`, `defaults`, `cx`, the `solid-js`
imports) is claimed around the source's own names, so none captures another. The target
reports nothing: what Solid cannot render as the other targets do is the analyser's to reject
(ADR-0033).

## Toolchain

The tests and tooling build, check and run Solid output through three entries:

- `@unframework/target-solid/toolchain` (Node): the Vite configuration of browser and SSR
  projects (`vite-plugin-solid`, with `ssr: true` for SSR and without solid-refresh), the
  framework compile check (L3: babel-preset-solid in `dom` and `ssr` modes, where a template a
  browser would parse differently is a warning), the type check (L4: one TypeScript 7 run over
  all files, against `tests/toolchains/solid/tsconfig.json`) and the lint (L5: oxlint with the
  shared baseline and eslint-plugin-solid as a JS plugin,
  `tests/toolchains/solid/output.oxlintrc.json`).
- `@unframework/target-solid/toolchain/client` (browser): mounts with `render`, its props a
  store, and rerenders by replacing each prop, removing those left out.
- `@unframework/target-solid/toolchain/server` (Node): renders with `renderToStringAsync`.

`test/output.test.ts` runs L3, L4 and L5 over what the emitter writes for sources that reach
every shape above, and renders the rewritten ones on the server (`test/rewrites.browser.test.ts`
mounts them in Chromium). `test/attributes.test.ts` type-checks every binding the analyser
accepts, as the output writes it, against Solid's JSX types, and proves that each attribute the
output spreads is one those types reject (`src/attributes.ts`).
