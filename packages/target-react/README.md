# @unframework/target-react

The React 19 target of the Unframework compiler: one function component in TSX per source
component, written as a React developer would write it (design §5.1):

- the type declarations the props use, copied as written (exported as in the source), then
  `export default function Badge({ label, tone = "info" }: BadgeProps)`, or
  `function Plain(props: PlainProps)` with `props.label` kept. A prop that no expression reads is
  left out with its default, and a parameter nothing reads is `_props` (an object form's keeps a
  name that is `_` and more, and takes `_` before any other: `_props`, `__`): unused bindings
  fail L5.
- expressions exactly as the source writes them; conditionals as ternary chains ending in
  `null` (never `&&`, which renders a `0`); lists as `.map((item, index) => <li key={…}>…)`,
  with the index only when something reads it; a root fragment as `<>…</>`.
- React's prop names (`className`, `htmlFor`, `tabIndex`, `strokeWidth`) and its rules for
  form controls (a `<textarea>`'s text becomes its `defaultValue`). Every boolean attribute the
  IR holds is one of React's boolean props, written bare or bound as it is. The attributes
  `@types/react` types as numbers are written as numbers (`tabIndex={0}`).
- an SVG `<title>` of several parts as one string, ``<title>{`${label} icon`}</title>``, branches
  and all: React's server renderer writes a title whose children are an array as an empty one. A
  part that may be nullish is written `part ?? ""`, so that it renders nothing as on the other
  targets, only where TypeScript reads its syntax as sometimes nullish: TS2869 and TS2871 reject
  the guard on `n + 1`, on `a ?? "x"` and on `a ?? null`, whose nullish fallback becomes `""`
  instead (`a ?? ""`). A `string` or `number` prop that is never absent needs no guard.
- `className="a b"` for a static class; any other class goes through `cx`, an inline helper
  printed after the component (`className={cx("badge", tone, { active })}`): the
  `class-binding` capability is emulated.
- `style={{ color: "red", marginTop: gap }}`, typed `as CSSProperties` (a type import from
  `react`) when it sets a custom property.
- a spread written out key by key (`title={attrs.title}`, through `?.` when the source may be
  absent), its `class` merged into the element's `cx`.

Every name the output introduces (`cx`, `CSSProperties`, `_props`) is claimed around the
source's own names, so none captures another. The target reports nothing: what React cannot
render as the other targets do is the analyser's to reject (ADR-0033).

## Toolchain

The tests and tooling build, check and run React output through three entries:

- `@unframework/target-react/toolchain` (Node): the Vite configuration of browser and SSR
  projects (`@vitejs/plugin-react`), the framework compile check (L3: React Compiler 1.0 on
  Babel 7, where a bailout is a warning), the type check (L4: one TypeScript 7 run over all
  files, against `tests/toolchains/react/tsconfig.json`) and the lint (L5: oxlint with the
  shared baseline and its React rules, `tests/toolchains/react/output.oxlintrc.json`).
- `@unframework/target-react/toolchain/client` (browser): mounts with `createRoot` inside
  `act`, and rerenders with new props through `root.render`.
- `@unframework/target-react/toolchain/server` (Node): renders with `prerender` and returns
  the component's HTML only.

`test/attributes.test.ts` checks the attribute spellings and values against `@types/react` for
every attribute the IR can hold (the names its types lack are the IR's `UNDECLARED_ATTRIBUTES`,
which the analyser rejects), and pins the one gap left: SVG's `<title>`, which React types as
HTML's.
