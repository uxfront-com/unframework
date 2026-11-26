# ADR-0121: Helpers live in shared modules

- **Status:** Accepted
- **Date:** 2026-11-22
- **Plan:** §11 D11; §3 (G2, P7, P8), §5.7, §6, §7.2 (L2, L14, L15), §8.4; amends ADR-0015 (a
  helper is emitted inline in every output that needs it)

## Context

ADR-0015 prints each helper a target emits for a missing primitive inline, in every output file
that needs it. So a design system's tree repeats the same helpers in almost every file. In the
corpus goldens, helper declarations are 44% of React's output bytes, 47% of Angular's and 55% of
Solid 2's. `scopeAttributes` alone is in about 355 files on every target but Vue. ADR-0015 named
this cost as its first negative, and L15 measures it.

The repetition buys nothing. A helper's text depends only on the target and the helper, so every
copy in a tree is the same code. The owner approved sharing them, with no runtime package.

## Decision

**The rule.** A helper that a target emits for a missing primitive lives in one generated module
per helper, in the `_unframework/` directory at the root of the output tree. Each output that uses
it imports it by a relative path. The module imports only its framework and other modules in the
same `_unframework/` directory. There is still no runtime package, and no `@uxfront/unframework`
import survives into any output (ADR-0006): an output depends only on its framework.

A helper is shared only when all four rules hold. Anything else stays inline:

- **R1, one text.** Its text depends only on the target and the helper's id, never on the
  component. Where two variants exist, one superset text may serve every caller when it gives each
  the behaviour it has today, with zero lint and type warnings. Otherwise each variant is a helper
  id of its own.
- **R2, no behaviour from wider state.** Module state that sharing would widen from one file to
  the whole tree stays inline, such as a queue, a counter, an observer or per-listener state. A
  `WeakMap` or `WeakSet` keyed by element may be shared once the live layers show that no element
  gets entries from two components that would now see each other's.
- **R3, a top-level declaration.** A class member, an `InjectionToken`, or a helper that reads a
  component's globals stays inline.
- **R4, worth an import.** A helper of 8 lines or fewer that 3 or fewer corpus files use stays
  inline: an import line costs about 45 bytes, and a short helper reads better beside its caller.

**One file per helper.** `compile()` compiles one source at a time, so a module that held every
helper of a tree would depend on what every source uses, and no single compile could write it. One
file per helper is a pure function of the target and the helper, so every place that merges trees
keeps one copy: the CLI's tree, the harness's case tree and the unplugin's virtual id. Bundlers
drop the modules no output imports, and each golden tree shows exactly the helpers its case uses,
so pull requests still review them (G2). The target names each file (P6), such as React's
`_unframework/cx.ts` and `_unframework/Transition.tsx`.

**The contract** has three parts:

- `EmitContext.helper(file, contents, from)` puts a helper in its module and gives the relative
  path the output at `from` imports it by. A target that never calls it prints its helpers inline,
  as before, and so does a target given a context without it.
- `CompileOptions.helperRoot` names the directory whose tree holds `_unframework/`: the directory
  of `filename` or one above it. It defaults to the source's own directory, so one compile's
  outputs are a complete tree. The CLI passes `srcDir`, the harness leaves it unset for each case,
  and the unplugin passes the root of the file's graph.
- `compile()` appends each helper module after the components and the copies, sorted, formatted
  and identity-mapped under `sourceMap`. `CompileResult.helpers` lists their paths, and `owners`
  leaves them out. A target that gives one module two texts is UF9001, and a shared module whose
  copy would take a helper module's place is UF1104.

**The hook queue.** Sharing doesn't remove the queue that `queueHook` keeps on `globalThis` under
`Symbol.for("unframework.directive-hooks@2")`. Within one tree, every output imports one module.
But separately compiled outputs still sort their hooks together: a directive module from one
package with a component from another, or a CLI-built package beside the same sources the
unplugin compiles. So the queue stays, versioned as before.

**The capability matrix.** Unchanged. An `emulated(helper)` cell names the helper, shared or
inline.

## Consequences

**Positive:**

- A tree holds each helper once. A design system's output shrinks by the share of each file its
  helpers took.
- A fix to a helper is one file in each tree, and the golden diff shows it once per case.
- Outputs still depend only on their framework.

**Negative:**

- A tree has more files: one per helper it uses.
- A `compile()` caller must write every file the result returns, the helper modules included. A
  caller that kept only the component files breaks. The packages are at 0.x, so the change takes
  a minor release.
- A helper module that imports another, such as `useDirective` importing `queueHook`, is a small
  graph inside `_unframework/` that the unplugin resolves on its own.

## Alternatives considered

- **Inline, as before (ADR-0015).** It keeps each file self-contained, at the cost the context
  measures.
- **One module per tree.** It would hold every helper in one file. No single compile can write
  it, since it depends on every source of the tree, and the CLI, the harness and the unplugin
  would each have to assemble it.
- **A runtime package per framework, `@unframework.dev/runtime-<framework>`.** It would share a
  helper across packages too, and ship a fix without a recompile. But every consumer would install
  it beside the framework, eight more packages would version with the compiler, and the helpers
  would leave the goldens. The owner declined it for now. The module path is the one place it
  would change: an import of `../_unframework/cx` could later name a package's subpath instead.
