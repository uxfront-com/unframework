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
- **`createSyntacticOracle({ root, readFile })`** is the syntactic adapter, on oxc. It reads
  `root`, a `/` and a file's path through `readFile`, as the compiler's `createFileResolver`
  does, and only the files a query needs. It follows type literals, local and imported
  interfaces and aliases across relative `.ts` and `.uf.tsx` files and their re-exports
  (`export { X } from`, `export type { X as Y } from`, `export * from`), `extends` chains,
  intersections, unions and literal unions. Interfaces of one name merge, as in TypeScript, and a
  member that an interface and its base both declare is the interface's own. An intersection's
  member is optional, or readonly, only when it is in every part. A name that a module neither declares nor imports
  is a global of TypeScript's lib (`Date`, `Element`): it stays opaque, and is not unresolved.
  Everything else comes back opaque and `unresolved`, never wrong: utility and generic types,
  package types, conditional, mapped and indexed-access types, `keyof`, `typeof`, template
  literals with holes, index and call signatures, overloaded methods, and an interface that
  extends itself. A member that two parts of an intersection declare with different types is a
  `conflict`. `update` drops the files it names, which the
  next query reads again.
- **`localShapes(parsed, filename)`** is the same resolution over one parsed module, synchronous,
  and it reads no file. An imported name is `unresolved` as `external`. It is the path for
  `analyze()` when it is given no shapes, which the analyser does not take yet.
- **`printShape(shape)`** prints a shape as a TypeScript type. With `{ canonical: true }` it
  sorts unions and members, which is how the contract compares two adapters.
- **The contract** (`@unframework/type-oracle/contract`): `typeOracleContract(name, factory)`
  registers one Vitest test per case, over the fixture projects in `test/fixtures/`. The factory
  gets each project's `root` and returns the adapter under test. Every adapter runs it from its
  own tests. The fixtures are not published, so the contract runs from the workspace only.

Relative specifiers are joined to the importer's path and read through `readFile`, so a project
in memory resolves as one on disk: `oxc-resolver` reads only the real disk. The dependency is for
package types, which the syntactic adapter resolves next.
Nothing here imports TypeScript's API: the tsgo adapter lives in its own package.
