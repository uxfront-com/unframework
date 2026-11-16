# ADR-0109: Directive values are checked by the tsgo oracle

- **Status:** Accepted
- **Date:** 2026-11-16
- **Plan:** §5.5, §5.6, §7.1, §9 M8; P2, P5, P8; ADR-0067, ADR-0071, ADR-0099, ADR-0107; amends
  ADR-0099 (the value's type is checked where the tsgo oracle compiles), ADR-0067 (the seam gains
  an optional query) and the harness's rules (a case may name its type oracle)

## Context

A directive takes a value of the type its `defineDirective<T>` names (ADR-0099). TypeScript doesn't
type a dashed JSX attribute, so `v-focus-trap={1}` type-checks in a `.uf.tsx` source where
`vFocusTrap` takes `boolean`. ADR-0099 lists the value's type as not guaranteed: only the outputs
whose own type check (L4) types a directive's value catch it, and only after the compile.

The analyser can't check it alone. It is synchronous, and reads types as written: the type oracle
answers every question about a type before it runs (ADR-0067). The seam answers `resolveShape` and
`printType`, which read a type node, never an expression.

Typing a value needs a checker: its
narrowing by the branch it sits in, the type a `computed` infers, the type of a setup function. Only
the tsgo adapter has one (ADR-0107), and only TypeScript's own packages may load its API (`LAYERS`).

## Decision

- **An optional query on the seam.** `TypeOracle.checkDirectiveValues(file, queries)` takes every
  directive's value in a module at once, one request per module, and answers, for each, whether
  the value's type is assignable to the directive's `T`, with both types as the checker prints them,
  or `null` where it can't say. The answer is plain JSON (P5) and names the files it read, as a
  shape's `dependencies` do. The syntactic adapter leaves the method out, so nothing is checked
  under it.
- **The analyser names the queries and reports the answer.** `directiveValueQueries` reads the
  syntax only: each `v-<kebab>` attribute with a value whose name is a top-level `const` of the
  module or a name it imports. `compile()` asks the oracle before it analyses, and the analyser
  reports a value the oracle says isn't assignable as UF6007 (`directive-value-type`), at the
  value, on an attribute that otherwise lowers. The project graph keeps the answer in the importer's
  key, and its files as edges (ADR-0071), so a change to a directive's type re-checks its users.
- **The tsgo adapter types the value where it is written.** It finds the value's node and the
  directive's name, follows an import to its declaration, and takes `T` from the name's type when
  that is the `Directive` interface of `@uxfront/unframework`, as the first
  `node_modules/@uxfront/unframework` up from the file resolves it. An expression is tested with the
  checker's own assignability. A static string, `v-tone="warn"`, is tested by its text, since the
  checker gives a JSX attribute's string literal the error type: it is assignable when `string` is,
  or when a member of `T` is that literal.
- **Never a wrong report.** The answer is `null` where the file's text on the disk differs from the
  compiled source at the value, where the name holds no `Directive` of the authoring package, where
  `T` or the value's type is the error type, where `T` is `never`, and for a string against a
  template literal, an `Uppercase<…>` or a branded string.
- **A corpus case may name its type oracle.** `case.json`'s `"typeOracle": "tsgo"` compiles the
  case's sources with the tsgo adapter, whose project holds only the case's directory, and whose
  syntactic layer reads the files the syntactic oracle would. The case is the only one that needs
  it: `diagnostics/directive-value-type`.

```tsx
const vFocusTrap = defineDirective<boolean>({ mounted(el, active) { … } });
<div v-focus-trap={1} />; // UF6007 under the tsgo oracle: `1` is not `boolean`
```

ADR-0099's "Not guaranteed" line now reads: the value's type is checked where the tsgo oracle
compiles, as UF6007, and is still not guaranteed under the syntactic oracle, where only the
outputs' L4 catch it.

## Consequences

**Positive:**

- An author on `typeOracle: "tsgo"` sees a wrong value at its span in the source, before any
  output is generated, whatever the target.
- The check is TypeScript's own assignability, narrowing included, and stays in
  `type-oracle-tsgo`, the one package that loads TypeScript's API.

**Negative:**

- The default oracle, which the unplugin always uses, checks nothing. The docs say so.
- Under the tsgo oracle, a module that applies a directive now starts the checker even when no
  type needs it, once per oracle.
- A canary that corrupts a source the checker reads from the disk loses the check (the text guard
  answers `null`), which L1 catches as a missing diagnostic.

## Alternatives considered

- **A typed shadow file (`const _: T = value`).** It loses the narrowing of the value's branch
  unless it copies the code around it, and needs a virtual file the tsgo oracle doesn't serve.
- **An expression typer in the syntactic adapter.** A second type checker, against ADR-0067.
- **Making tsgo the default oracle.** A separate decision with its own cost to every compile.
