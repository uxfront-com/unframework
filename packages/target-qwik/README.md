# @unframework/target-qwik

The Qwik 2 target of the Unframework compiler (experimental while Qwik 2 is in beta): one
`component$` in TSX per source component, written as a Qwik developer would write it (design
§5.6).

```tsx
import { component$ } from "@qwik.dev/core";

export interface BadgeProps {
  label: string;
  tone?: "info" | "warn";
}

export default component$<BadgeProps>(({ label, tone = "info" }) => {
  return <p class={["badge", tone]}>{label}</p>;
});
```

- The type declarations the props use, copied as written (exported as in the source), then
  `component$<Props>` with the source's destructuring and defaults, in the source's order, or
  `(props) => …` with `props.label` kept. A prop that no expression reads is left out with its
  default, and so is the parameter when nothing reads it (`component$<Props>(() => …)`): unused
  bindings fail L5. Qwik's optimizer turns the destructuring into reactive reads and a default
  into `??`, which the analyser allows only where the prop cannot be `null` (ADR-0034).
- The export shape follows the source: a default export, a same-named `export const`, or an
  export list for aliases and several exports of one component.
- Expressions exactly as the source writes them; conditionals as ternary chains ending in
  `null` (never `&&`, which renders a `0`); lists as `.map((item, index) => <li key={…}>…)`,
  with the index only when something reads it; a root fragment as `<>…</>`.
- Attributes on HTML elements take the names Qwik's JSX types declare (`tabindex` →
  `tabIndex`, `readonly` → `readOnly`, `autocorrect` → `autoCorrect`); SVG and MathML keep their
  case-sensitive names. Static values take the types Qwik declares: numbers for what React or
  Qwik types as a number (`tabIndex={0}`, `colSpan={2}`), booleans for `spellcheck` and
  `draggable` (`{false}`), and HTML's boolean attributes bare. An attribute Qwik's types declare
  under no name on that element (`<input form>`, `<input list>`, `enterkeyhint` but on
  inputs) is an object spread, `{...{ list: "colours" }}`, whose keys
  TypeScript leaves unchecked; so is a static `contenteditable` that `contentEditable` does not
  take (`"plaintext-only"`).
- An SVG `<title>` with one child that types as `string | undefined`: Qwik types `<title>`'s
  children as a string, in SVG as in HTML, so several parts, a number, `null` or JSX fail L4
  though Qwik renders them. A text, or a value that is a string or `undefined` (`{label}`,
  `{note}`, `{label.toUpperCase()}`), stays as written. Several parts become one template
  literal, ``<title>{`${label} icon`}</title>``; a conditional alone a ternary chain of strings
  ending in `undefined` (`{paused ? "Paused" : `Sending ${name}`}`); and any other value alone a
  string: `{n ?? ""}` for a prop that may be `null`, ``{`${count}`}`` for a number. A part that
  may be nullish is written `part ?? ""`, so that it renders nothing as on the other targets,
  only where TypeScript reads its syntax as sometimes nullish: TS2869 and TS2871 reject the
  guard on `n + 1`, on `a ?? "x"` and on `a ?? null`, whose nullish fallback becomes `""`
  instead. A prop whose declared type is never nullish needs no guard.
- `class` in Qwik's own forms, with no helper: a lone dynamic part as itself (`class={tone}`),
  toggles alone as one object (`class={{ active, "is-busy": busy }}`), anything else as an
  array (`class={["badge", tone, { active }]}`). A toggle whose condition may be an array or an
  object, or whose type the target cannot see (a loop item's member), is written
  `Boolean(…)`: Qwik's types take only primitives there.
- `style={{ color: "red", marginTop: gap, "--gap": size }}`: camelCase keys, which Qwik writes
  in kebab case, and custom properties as written.
- A spread written out key by key (`title={attrs.title}`, through `?.` when the source may be
  absent), its `class` merged into the element's `class`: Qwik's own spread would let the later
  `class` win (ADR-0039).

Every capability is native. `component$` is imported under a free name when the source uses
it. The target reports nothing: what Qwik cannot render as the other targets do is the
analyser's to reject (ADR-0033).

## Toolchain

Tests and tooling use three Node and browser entries (plan §5.7, `Toolchain` in
`@unframework/codegen`):

| Entry                                       | What it is                                                                                                                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@unframework/target-qwik/toolchain`        | `toolchain`: the Vite configuration of `browser` and `ssr` projects (`qwikVite` with `srcDir` at the project root, `csr` in the browser, no app entry, HMR, the image dev tool and the inspector off), L3, L4 and L5. |
| `@unframework/target-qwik/toolchain/client` | `mount`: a client-only render with the qwikloader, settled with Qwik's render promise. Every mount needs a fresh container.                                                                                           |
| `@unframework/target-qwik/toolchain/server` | `renderToString`: `renderToString` from `@qwik.dev/core/server` into a fragment container, returning only the component's HTML.                                                                                       |

- **L3** runs the Rust optimizer from `@qwik.dev/optimizer` (the exact version
  `@qwik.dev/core` depends on, checked at start) over each file, for the client and the
  server, with the `segment` entry strategy.
- **L4** runs TypeScript 7 (tsgo) once over every file, through a temporary tsconfig in
  `<toolchainDir>/.uf-tmp/` that extends `<toolchainDir>/tsconfig.json`. In this repo the
  toolchain directory is `tests/toolchains/qwik`.
- **L5** (ADR-0042) runs oxlint with the shared baseline and eslint-plugin-qwik as a JS plugin,
  without its type-aware rules (`tests/toolchains/qwik/output.oxlintrc.json`).

All three reject when they cannot start. The mount adapter renders the component through
`Host` (`src/toolchain/host.ts`), a `component$` the optimizer compiles, which passes it the
props a signal holds: `rerender` replaces the signal's props whole, so an absent prop takes its
default again (ADR-0043). Both adapters hand the props over as a parent's written attributes
do (`<Card bio={bio} />`, which the optimizer compiles to `_jsxSorted`), so a `null` arrives as
`null`: Qwik's public `jsx()`, like a consumer's spread (`<Card {...user} />`), goes through
`_jsxSplit`, which deletes null-valued props (`src/toolchain/element.ts`). They rely on Qwik
internals (`_jsxSorted`, `_getDomContainer`, `_waitUntilRendered`) until Qwik 2 has public
ways to do both.

`test/attributes.test.ts` type-checks every attribute the authoring types declare against
Qwik's JSX types as the target writes it: the names, the number- and boolean-typed values, the
untyped attributes, and the bound values Qwik types narrower than the authoring types, pinned.
