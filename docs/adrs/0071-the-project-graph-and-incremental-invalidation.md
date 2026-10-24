# ADR-0071: The project graph and incremental invalidation

- **Status:** Proposed
- **Date:** 2026-10-24
- **Plan:** §5.6 (layer 2), §5.10, §8.2, §9 M5, M6; P2, P8; ADR-0021, ADR-0027, ADR-0053, ADR-0067,
  ADR-0069, ADR-0070; amends ADR-0053

## Context

ADR-0053 gives `compile()` a resolver, and `createFileResolver` reads each child's API from its
declarations, cached by content. It sees only `.uf.tsx` children. M5 adds three more kinds of
edge: imported types (ADR-0067), composables (ADR-0069) and shared `.ts` modules (ADR-0070). A
change to any of them can change what a dependent compiles to, so plan §5.10 puts a project graph
in M5, and its exit criterion says that changing an imported props type recompiles exactly its
dependents.

- **v1 invalidated nothing else** (§5.10): it hashed each file on its own.
- **ADR-0053 left two items to M5:** the graph that replaces `createFileResolver`, and reporting
  import cycles.
- **Two modules that import each other** fail to load on Angular without `forwardRef`, as ADR-0053's
  spike found, and no case renders such a cycle.
- **Determinism (P8).** The graph's keys are root-relative paths, so its decisions are the same on
  every machine.

## Decision

**The project.** `createProject({ root, targets, typeOracle })`, in `@unframework/compiler`, holds
the module graph and its reverse edges: components, composables, shared modules, stylesheets and
type dependencies.

- It reads each compile's `CompileResult.dependencies`: the files and packages (`pkg:<name>`) the
  oracle read, the `.ts` modules a component reached, and the composables it called.
- Each `.ts` module's copy belongs to that module's own node, so it is emitted once.
- It replaces `createFileResolver` behind the `resolve` option. `createFileResolver` stays as a
  thin wrapper over a project, or goes with its callers moved.

**Invalidation:**

- On a change, the project calls `oracle.update` and recompiles only the reverse edges of what
  changed.
- A module's cache key is its source hash plus the hashes of the APIs and shapes it resolved. So an
  edit that leaves a shape unchanged stops there (early cutoff).
- The invalidation test pins it. `a.ts` declares a props type. `B.uf.tsx` imports it directly,
  `C.uf.tsx` reaches it through `useC.uf.ts`, and `D.uf.tsx` doesn't use it. Editing the type
  recompiles `B`, `useC` and `C` once each, and never `D`. An edit to `a.ts` that leaves the shape
  unchanged recompiles no component, and still refreshes `a.ts`'s own copy.

**Cycles.** An import cycle longer than a self-import is UF1205 (`import-cycle`, error), with
`diagnostics/import-cycle`. A component that renders itself stays allowed (ADR-0053). This covers
two modules that import each other too, which goes further than ADR-0053's open item ("cycles
longer than two modules"), since Angular can't load that pair as built.

**The unplugin** compiles through a project, and calls `addWatchFile` for every edge, so an edit
to a `.ts`, a `.uf.ts` or a type dependency invalidates its dependents' virtual modules through
Vite's module graph. Hot updates stay M6's (§9).

**The content mapper** analyses components through the same project, up to their declarations
(ADR-0072).

**What it amends.** ADR-0053's `createFileResolver` gives way to the project behind the same
option, and its open items on the graph and on cycles are settled here.

## Consequences

**Positive:**

- Changing an imported type recompiles exactly its dependents, and an unchanged shape stops the
  recompiles.
- One graph serves the unplugin, the harness and the content mapper, so a child's API is analysed
  once per change, not once per process.
- An import cycle is a diagnostic at its span, never a load failure on one target.

**Negative:**

- The project holds state, so its callers must route every change through it. A caller that skips
  `update` serves stale output.
- Two modules that import each other are rejected on every target, so two components that render
  each other live in one module.

**Open:**

- Hot updates (`handleHotUpdate`) and the other bundlers are M6's.
- Extending UF5001 across modules, to a sheet that two modules import, is a later issue: the graph
  can tell the two modules apart (ADR-0063).
- §5.10's IR cache as JSON, for the CLI and CI, comes with the CLI.

## Alternatives considered

- **Keep `createFileResolver` and add watch edges in the unplugin.** Each caller would rebuild its
  own picture of the edges, and none could stop at an unchanged shape.
- **Invalidate by source hash alone.** Every edit to a type file would recompile every dependent,
  even one that leaves the shape as it was.
- **Report only cycles longer than two modules,** as ADR-0053 wrote. A pair that imports each other
  fails to load on Angular, and no case needs one.
