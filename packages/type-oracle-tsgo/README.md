# @unframework/type-oracle-tsgo

The TypeOracle adapter on tsgo's checker (plan §5.5, ADR-0067). It is the only package that
loads TypeScript's API: `typescript/unstable/sync`, pinned exactly at 7.0.2 by the catalog.

- **`createTsgoOracle({ root })`** implements `TypeOracle` from `@unframework/type-oracle` over the
  files under `root`, read from the disk. It is opt-in: the compiler's default stays the
  syntactic adapter.
- **What it adds.** Each query is resolved by the syntactic adapter first. A part it leaves
  `unsupported` (a conditional or mapped type, `infer`, `keyof`, `typeof`, an indexed access, a
  template literal with holes) is evaluated by tsgo, and replaced by its result when a
  `TypeShape` can hold that result: primitives, literals, unions, arrays, tuples, objects with
  property and method members, functions with one signature, and type parameters. Its entry in
  `unresolved` goes with it. A part reached only through a union keeps its entry, since which
  of the union's parts it belongs to is not sure. A part whose result holds anything a shape
  cannot hold stays opaque and `unresolved` as a whole: index signatures, overloads, generic and
  construct signatures, accessors, classes and enums, symbol keys, a mapped type over keys that
  are still generic (`keyof T`), a type that expands without end, lib types such as `Date`, and
  anything declared outside `root`, whose file a shape cannot name without the machine (P8).
- **What it keeps.** Every other answer is the syntactic adapter's: members' origins,
  `construction`, `dependencies` and which packages it reads. So both adapters pass the same
  contract, and a props type resolves alike under either unless it needs the checker. A member
  tsgo evaluates names the declaration it comes from, and its file joins `dependencies`. A
  member a mapped type makes takes its modifiers and type from the mapping, so it keeps the
  declaration it maps but no `typeText`. One made from keys alone has no declaration, and is
  placed at the mapped type.
- **The checker** is a tsgo process over a project of every TypeScript file under `root`, with
  `strict`, `moduleResolution: "bundler"` and `jsx: "preserve"`, served from memory so the root
  needs no tsconfig. The first query that needs the checker starts it, a query the syntactic
  adapter resolves alone never does, and `dispose` stops it. `update` tells it which files
  changed, were created or were deleted. A package that changed stops it, and the next query
  that needs it starts a new one.
- **`printType`** prints the resolved shape, as the syntactic adapter does, and rejects one with
  unresolved parts.

Its tests run the contract suite from `@unframework/type-oracle/contract` with
`{ checker: true }`, and start and stop their own checker processes.
