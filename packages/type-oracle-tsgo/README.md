# @unframework.dev/type-oracle-tsgo

The TypeOracle adapter on tsgo's checker (plan §5.5, ADR-0067, ADR-0107). It is the only package
that loads TypeScript's API: `typescript/sync`, pinned exactly at `7.1.0-beta` by the catalog.
Here is how it works:

- **`createTsgoOracle({ root, include, readFile })`** implements `TypeOracle` from
  `@unframework.dev/type-oracle` over the files under `root`, read from the disk. It is opt-in: the
  compiler's default stays the syntactic adapter. `include` names the files the checker's project
  holds, as a tsconfig's `include` relative to `root`, every TypeScript file under it by default.
  `readFile` reads the files its syntactic layer asks for, the disk by default. The checker itself
  always reads the disk.
- **What it adds.** Each query is resolved by the syntactic adapter first. A part it leaves
  `unsupported` (a conditional or mapped type, `infer`, `keyof`, `typeof`, an indexed access, a
  template literal with holes) is evaluated by tsgo, and replaced by its result when a
  `TypeShape` can hold that result: primitives, literals, unions, arrays, tuples, objects with
  property and method members, functions with one signature, and type parameters. Its entry in
  `unresolved` goes with it. A part reached only through a union keeps its entry, since which
  of the union's parts it belongs to is not sure. A part whose result holds anything a shape
  cannot hold stays opaque and `unresolved` as a whole: index signatures, overloads, generic and
  construct signatures, an object that can also be called, accessors, classes and enums, symbol
  keys, a mapped type over keys that are still generic (`keyof T`), an intersection with any such
  part, a type that expands without end, lib types such as `Date`, anything declared outside
  `root`, whose file a shape cannot name without the machine (P8), and a copy of a package
  other than the one the root resolves. So does a part whose text names something missing (a
  typo, a stale import), which tsgo would evaluate as its error type (`keyof Missing` is
  `string | number | symbol`).
- **What it keeps.** Every other answer is the syntactic adapter's: members' origins,
  `construction`, `dependencies` and which packages it reads. So both adapters pass the same
  contract, and a props type resolves alike under either unless it needs the checker. A member
  tsgo evaluates names the declaration it comes from, and its file joins `dependencies`, as do
  the files of every declaration the evaluated construct's text reaches, through type
  references, `typeof`, `extends` and import types (`keyof X` reads `X`'s file and what `X`
  reads). A package's file is named as the syntactic adapter names it,
  `pkg:<name>/<path>`, or `pkg:<name>@<version>/<path>` for a package the root resolves no copy
  of. A member a mapped type makes takes its modifiers and type from the mapping, and an
  intersection's member from all its parts (readonly only when each part makes it so), so it
  keeps the declaration it comes from but no `typeText`. One a mapped type makes from keys alone
  has no declaration, and is placed at the mapped type.
- **The checker** is a tsgo process over a project of every TypeScript file under `root`, with
  `strict`, `moduleResolution: "bundler"` and `jsx: "preserve"`, served from memory so the root
  needs no tsconfig. The first query that needs the checker starts it, a query the syntactic
  adapter resolves alone never does, and `dispose` stops it. `update` tells it which files
  changed, were created or were deleted, and has it rebuild the program. A package that changed
  stops it, and the next query that needs it starts a new one.
- **`printType`** prints the resolved shape, as the syntactic adapter does, and rejects one with
  unresolved parts.
- **`checkDirectiveValues(file, source, queries)`** (ADR-0109) checks every directive's value in a
  module, in one call. It types a shadow of `source`, the text the caller compiles, in which each
  value is wrapped where it stands, `v-tone={__ufDirectiveValue(vTone, (value))}`, with a helper
  that takes `Directive<T, any>` and `NoInfer<T>`. So the value has `T` as its contextual type, as
  in an assignment, and keeps its branch's narrowing: a template literal or a generic call is
  typed as TypeScript types it there. The shadow, `<file>.uf-directive-values.tsx` beside the
  file, lives in a layer of the checker's snapshot and is removed before the method returns, in
  one synchronous stretch, so no other query sees it. A leading byte order mark is dropped.
- **What it answers.** `T` comes from the directive's type when that is the `Directive` interface
  of `@uxfront/unframework`, as the first `node_modules/@uxfront/unframework` up from the file
  resolves it, by its real path. The answer is the checker's assignability, with both types
  printed, or `null` where the directive isn't that `Directive`, either type is the error type,
  `T` is `never`, or the shadow is outside the project `include` builds. Its `dependencies` name
  each directive's declaration file but the queried one. A module with a directive's value starts
  the checker, even when no type needs it, and one with none never does.

Its tests run the contract suite from `@unframework.dev/type-oracle/contract` with
`{ checker: true }`, and start and stop their own checker processes.
