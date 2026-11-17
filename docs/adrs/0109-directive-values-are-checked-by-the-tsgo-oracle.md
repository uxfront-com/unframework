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

Typing a value needs a checker: its narrowing by the branch it sits in, the type a `computed`
infers, the type of a setup function. Only the tsgo adapter has one (ADR-0107), and only
`type-oracle-tsgo` and the test toolchains may load TypeScript's API (`LAYERS`).

A value's type also depends on what it is given to. A dashed attribute gives its value no
contextual type, so the checker types `` `${tone.value}` `` as `string` and a generic call's
`cast(1)` as `unknown`, where an assignment to `T` types them as `T` allows. Typing the value as it
stands reports correct code.

## Decision

- **An optional query on the seam.** `TypeOracle.checkDirectiveValues(file, source, queries)` takes
  every directive's value in a module at once, one request per module, with the source the caller
  compiles. It answers, for each, whether the value's type is assignable to the directive's `T`,
  with both types as the checker prints them, or `null` where it can't say. The answer is plain
  JSON (P5) and names the files it read, as a shape's `dependencies` do. The syntactic adapter
  leaves the method out, so nothing is checked under it.
- **The analyser names the queries and reports the answer.** `directiveValueQueries` reads the
  syntax only: each `v-<kebab>` attribute with a value whose name is a top-level `const` of the
  module or a name it imports. `compile()` asks the oracle before it analyses, and the analyser
  reports a value the oracle says isn't assignable as UF6007 (`directive-value-type`), at the
  value, on an attribute that otherwise lowers. The project graph keeps the answer in the importer's
  key, and its files as edges (ADR-0071), so a change to a directive's type re-checks its users.
- **The tsgo adapter types an in-place shadow.** It copies the source it is given and wraps each
  value where it stands, `v-tone={__ufDirectiveValue(vTone, (value))}`, a string attribute's
  literal included, with a helper declared
  `<T>(directive: Directive<T, any>, value: NoInfer<T>) => void`, under a name the source doesn't
  hold. The value takes `T` as its contextual type, as in an assignment, and keeps its branch's
  narrowing. A leading byte order mark is dropped, since the parser's spans count it and the
  checker's positions don't. The shadow sits beside
  the file, so its imports resolve alike, in a layer of the checker's snapshot, never on the disk,
  and the adapter removes it before it answers. Adding, checking and removing run in one
  synchronous stretch, so no other query sees the shadow or replaces the snapshot in between. It
  takes `T` from the directive's type when that is the `Directive` interface of
  `@uxfront/unframework`, as the first `node_modules/@uxfront/unframework` up from the file
  resolves it, and tests the value with the checker's own assignability.
- **Never a wrong report.** The checker types the text that is compiled, not the disk's. The
  answer is `null` where the directive holds no `Directive` of the authoring package, where `T` or
  the value's type is the error type, where `T` is `never`, and where the shadow is outside the
  checker's project.
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
- Each module with a directive's value replaces the checker's snapshot twice, to add and remove
  its shadow, and the program is updated for that one file each time.
- Other files are read from the disk, as `resolveShape`'s checker reads them: a caller that holds
  an imported file unsaved tells the oracle through `update`, as before.

## Alternatives considered

- **The value's type as it stands.** Without `T` as its context, a template literal is `string`
  and a generic call's result `unknown`, so correct code is reported.
- **A separate shadow file (`const _: T = value`).** It loses the narrowing of the value's branch
  unless it copies the code around it.
- **An expression typer in the syntactic adapter.** A second type checker, against ADR-0067.
- **Making tsgo the default oracle.** A separate decision with its own cost to every compile.
