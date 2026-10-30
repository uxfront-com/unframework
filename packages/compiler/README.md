# @unframework/compiler

The Unframework compiler (plan §5.1):

```ts
import { compile } from "@unframework/compiler";

const result = await compile(source, {
  filename: "src/Hello.uf.tsx",
  targets: ["react", "vue", "svelte", "solid", "angular", "qwik", "astro"],
});
result.outputs.vue; // [{ path: "Hello.vue", contents: "<template>…</template>\n" }]
result.diagnostics; // sorted, with stable UF codes
```

`compile()` runs the passes in order: parse (oxc), analyse and lower into IR, the `ir` plugin hook,
the capability check for each target, each target's `emit`, the `output` plugin hook, and
formatting (oxfmt). It is a pure function of the source and the options, and it throws only for
invalid options (an unknown target name, two targets with one name): every other problem is a
diagnostic, including a plugin or a target that throws, or returns or reports something malformed. Hooks and
targets receive the IR frozen, a target's missing capability cell counts as unsupported, and two
output files whose paths differ only in case are reported, since they collide on macOS and Windows.
The `resolve` option gives each imported `.uf.tsx` module's public API (ADR-0053), which the
analyser lowers a parent's components by; `createFileResolver({ root, readFile, typeOracle })`
reads the file, analyses its declarations (never its children's), their types read through the
type oracle over the same root (ADR-0067), and caches that by its contents and its shapes. Without
`typeOracle`, a child's types are read from its own module alone. An import it
cannot resolve is UF1202, and a resolver that throws UF9001. The resolver's `stylesheet` reads each
stylesheet the source imports (ADR-0063), and `createFileResolver` also reads a child's sheets, for
the scope id its API carries, and caches by their text too: a sheet it cannot read is UF5005.
The resolver's `module` reads each shared `.ts` module the source imports or re-exports from, a
type re-export alone included (ADR-0070), a specifier without an extension naming its `.ts`, and
`createFileResolver` follows its relative imports through
every `.ts` module they reach, each once, noting the first framework or `unframework` import
(UF1204) and the first relative import it cannot read (UF1202). A value import of a module it
cannot read, or without a resolver, is UF1202. Each output tree beside a component's files holds a
copy of every module the source reaches, unchanged, at its path relative to the source: neither
the hooks nor formatting see it, and `owners` leaves it out. A copy named like a component's output
file, without the extensions (an output imports `./CardIcon`, and `./card-icon` on Angular), is
UF1104 at the import that reaches it, for the module's own components and every child it
imports, and withholds the module from every target.
After the `ir` hooks, `compile()` runs the codegen scoper once per sheet of the module the targets
emit from; a selector it rejects (UF5004, in the sheet's file) withholds the module from every
target, as an analyser error does. A styled component's files end, on every target, with its
scoped sheet, `<source>.css` (`Button.uf.tsx.css`): its sheets scoped and joined in import order,
which the `output` hooks see and formatting keeps as printed. `CompileResult.owners` names the
component each output file is written for, by target, which the unplugin loads files by; the
sheet is no component's module, and is left out.
The `typeOracle` option is the type oracle (plan §5.5, ADR-0067): before it analyses, `compile()`
asks it for the shape of each type the analyser reads (`shapeQueries`), and the analyser lowers
props from those shapes, so a props type may come from another file or a package. Its queries name
files relative to its root, as `filename` is. Without it, `compile()` uses an in-process syntactic
oracle over the one source, which reads no file, so an imported type is UF6001; an oracle that
throws is UF9001. `createSyntacticOracle({ root, readFile })` is the type oracle's syntactic
adapter, re-exported so a caller builds a file-backed one without another dependency; the caller
disposes of its oracle. The oracle reads the source's own file too, so it must hold the text
`compile()` is given: a caller that compiles an unsaved edit updates its oracle first.
`CompileResult.dependencies` lists what the compile read or looked for through the oracle: files
relative to its root, and packages as `pkg:<name>`, a package that is not installed included,
sorted (ADR-0071). It also lists each shared `.ts` module the resolver read, and each `.uf.ts`
module whose composables the source imports, one that is missing included, named as `filename` is.

**The project graph** (ADR-0071). `createProject({ root, readFile, targets, typeOracle })` takes
the files `createFileResolver` does and the options each compile takes, but `filename` and
`resolve`. Its `compile(file)` compiles a module, named relative to `root`, through its own
resolver and oracle, and keeps the result, which leaves out the copies of shared `.ts` modules:
each copy is its module's own node, which `copy(file)` gives. Its `update(files)` tells the oracle
which files changed, reads each copy again, and checks every compiled module that reaches a changed
file, directly or not, along the graph's reverse edges: it compiles one again only where a hash of
its source and of every answer it was given (its children's APIs and the shapes they were read
with, its stylesheets, the files of its shared modules, its cycles and its own types' shapes)
changed, so an edit that leaves a shape alone stops there. It returns the modules it compiled and
the copies that were added, changed or went. `dependencies(file)` lists what a module read. A caller that changes a
file without `update` gets the last result. `createFileResolver` is a project's `resolve`.

**Cycles.** The resolver's `cycle` gives the files of the cycle of component edges an import
closes, from the importer back to it: a component edge is a value import of a component from
another `.uf.tsx` module. `compile()` asks it for each of the source's own component edges and
reports UF1205 at the import that closes a cycle, which withholds the module from every target, as
an analyser error does. An injection key, a type or a shared module imported back closes no cycle
(UF2033's context pattern), and a component that imports itself is UF1203's.

**Composables** (ADR-0069). The resolver gives a `.uf.ts` module's API too: its `composables`,
each with its parameters' kinds and its members' kinds and flags, which a caller's `Use` item is
lowered by, so a caller's output never depends on a composable's body. `compile()` also takes a
`.uf.ts` source: its IR holds the module's composables and no component, and each target emits
each composable with its `emitComposable`, formatted as a component's files are, with `owners`
naming the composable. The `output` hooks see none of it. `emitComposable` is optional until each
target's composables lane lands: a target without it reports UF1002 at the composable, for that
target, and emits nothing for it.
A capability that refines one the target cannot support (a listener's options and semantics, and
`nextTick`, refine `interactivity`: codegen's `CAPABILITY_PREREQUISITES`) is not reported again, so
Astro reports one inert listener once.

An `ir` hook's module must be valid IR (its schema and `checkInvariants`), keep the analysed file
and every span inside the source, and hold only the expressions, setup code, functions (their
parameters, types, defaults, bodies, event controls and flags), type annotations, declared events,
type declarations and stylesheets with their scope id the analyser produced for that source, each
whole (span, code and every reference with all its fields: a write stays a write, a call a call):
a plugin may move, copy or drop analysed code, never write its own, because every target copies
that code into its output and the IR cannot parse it (ADR-0032). Each function stays in a place of its context and role,
and each piece of code in a place of its context and kind (statements or an expression): the
analyser judges client code by looser rules than a getter or an initial value (ADR-0045), so a
local function moved into a `computed` is refused. A module that breaks any of this is UF8001,
and the hook's result is dropped.
