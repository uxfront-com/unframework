# @unframework/type-oracle

The TypeOracle interface and the syntactic resolver (plan §5.5).

- **`TypeOracle`** is the seam between the compiler and a type-checker: `resolveShape`,
  `printType`, `update` and `dispose`, all asynchronous, with serialisable results. A query names
  a type as written: its file, relative to the oracle's root, and the span of its type node there.
- **`TypeShape`** is a table of nodes, so a recursive type is a cycle of ids. A node is a
  primitive, a literal, a flattened union, an array, a tuple, an object with members, a
  function, a type parameter in scope at the query, or an opaque node for a type kept as written.
  Each member records whether it is optional or readonly, its file, the named declaration it
  belongs to and whether that is exported, its own span, its type's text and span as written, and
  the type names that text references. Each shape also lists its `construction`, its
  `dependencies` (files relative to the root, packages as `pkg:<name>`, never an absolute path)
  and its `unresolved` spans, each with its reason.
- **`createSyntacticOracle({ root, readFile })`** is the syntactic adapter, on oxc and
  oxc-resolver. It reads `root`, a `/` and a file's path through `readFile`, as the compiler's
  `createFileResolver` does, and only the files a query needs. It follows type literals, local
  and imported interfaces and aliases across relative `.ts` and `.uf.tsx` files and their
  re-exports (`export { X } from`, `export type { X as Y } from`, `export * from`), `extends`
  chains, intersections, unions and literal unions. Interfaces of one name merge, as in
  TypeScript, and a member that an interface and its base both declare is the interface's own. An
  intersection's member is optional, or readonly, only when every part that declares it makes it
  so. A name that a module neither declares nor imports is a global of TypeScript's lib (`Date`,
  `Element`): it stays opaque, and is not unresolved.
  - **Utility types.** `Partial`, `Required`, `Pick`, `Omit` and `Readonly` map the members of
    the object they are given, which keep their files and declarations. `Required` takes
    `undefined` out of an optional member's type, as TypeScript does without
    `exactOptionalPropertyTypes`. A utility over a type that is not an object or with no
    arguments, `Pick` and `Omit` with keys that are not literals or over an object with a numeric
    member (`2` and `"2"` are two keys to TypeScript, and one name here), and a `Pick` of a key
    the object lacks are unresolved.
  - **Generic declarations** are instantiated with their arguments and their parameters'
    defaults, a default reading the parameters before it. Each instantiation is one object with
    its `typeArguments`, so `Tree<string>` inside itself is a cycle. An instantiation that takes
    new arguments inside itself (`interface N<T> { n: N<T[]> }`) never ends when expanded
    eagerly, as this adapter expands, so it stops after ten levels, unresolved. So are too many or
    too few arguments, and a generic global (`Record`, `Map`).
  - **Packages.** A bare specifier is resolved with oxc-resolver from the importing file on disk,
    as TypeScript's bundler resolution does: the `types` condition of `exports`, then `types` and
    `typings`, then the package's `@types/` package. A package's own imports resolve the same way.
    Its files are named `pkg:<name>/<path in the package>`, by the name it is imported under
    (`pkg:x` for types from `@types/x`), never an absolute path, and are read through `readFile` by
    the path oxc-resolver found. The copy of a package that the root resolves owns its name, so
    every query gives the same answer. A package the root resolves no copy of, such as a
    dependency's own dependency under pnpm's isolated layout, is named by its `package.json`
    version too, `pkg:<name>@<version>/<path>`, as TypeScript identifies a package: two versions
    keep two names, and `dependencies` still lists it as `pkg:<name>`. These are
    `missing-module`: a package that is not installed, a subpath it does not export, a copy other
    than the root's when the root resolves one, a relative import that leaves the package, and a
    subpath import (`#types`), whose `package.json` `imports` the adapter does not read.
    Everything else comes back opaque and `unresolved`, never wrong: classes and enums,
    conditional, mapped and indexed-access types, `keyof`, `typeof`, template literals with holes,
    index and call signatures, computed keys that are not literals, generic and overloaded methods,
    accessors, and an interface that extends itself. A member the adapter cannot read keeps its
    name, so no base or other part fills it in. A member that two intersection parts or two
    interface declarations write with different types is a `conflict`, with its type kept as
    written; so is a method and a property of one name in two interface declarations. Two types are
    the same only when the adapter is sure: one declaration, one opaque node, or objects whose
    members are all known and nothing lost. What a base or a part loses, the object built from it
    loses too.

  It keeps each file parsed and each shape until `update` names a file the shape was read from: a
  file it read, a candidate of a relative specifier that did not exist, or a package as
  `pkg:<name>`. So an edit drops the shapes of the file and of every module that reached a type
  through it, and a package installed, removed or changed is resolved and read again, every
  version of it. A
  workspace package linked under `node_modules` is a package too, so an edit to its sources
  takes its `pkg:<name>`, not their paths.

- **`printType`** prints the resolved shape, with an instantiation reached inside itself by its
  name and arguments (`Tree<string>`). It rejects a type with unresolved parts, and a recursive
  object with no name, which TypeScript cannot write without one.
- **`localShapes(parsed, filename)`** is the same resolution over one parsed module, synchronous,
  and it reads no file. An imported name is `unresolved` as `external`. It is meant for
  `analyze()` when it is given no shapes; the analyser does not call it yet.
- **`printShape(shape)`** prints a shape as a TypeScript type, and throws for a recursive object
  with no name. With `{ canonical: true }` it sorts unions and members, prints that recursion as
  `(cycle ^n)` and an unresolved opaque node as `(unresolved)`, which is how the contract
  compares two adapters.
- **The contract** (`@unframework/type-oracle/contract`):
  `typeOracleContract(name, factory, options)` registers one Vitest test per case, over the
  fixture projects in `test/fixtures/`. The factory gets each project's `root` and returns the
  adapter under test. Every adapter runs it from its own tests. A conditional and a mapped type
  are unresolved for the syntactic adapter; an adapter backed by a type-checker passes
  `{ checker: true }`, and is held to their evaluated shapes instead. The `packages` project
  commits its `node_modules`, as a package manager installs them. The fixtures are not published,
  so the contract runs from the workspace only.

Relative specifiers are joined to the importer's path and read through `readFile`, so a project
in memory resolves as one on disk. oxc-resolver reads only the real disk, so it resolves packages
only.
Nothing here imports TypeScript's API: the tsgo adapter lives in its own package.
