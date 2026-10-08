# ADR-0053: A child's API reaches `compile()` through a resolver

- **Status:** Proposed
- **Date:** 2026-10-08
- **Plan:** §4.1, §4.3 (Composition), §5.1, §5.3, §5.6 (layer 2), §5.10, §8.2, §8.4, §9 M3, M5;
  P2, P4, P5, P6, P7, P8; R5, R12; ADR-0021, ADR-0027, ADR-0034, ADR-0036, ADR-0047; amends
  ADR-0021 and ADR-0027

## Context

`compile()` handles one file. An import of a `.uf.tsx` file is UF1002 (`analyzer/src/analyze.ts`),
and so is a PascalCase tag (`analyzer/src/lower.ts`). Plan §5.10 puts the project graph in M5.
M3 cannot wait for it, because lowering a component element needs the child's public API:

- **Angular** must know the child's inputs, its outputs and their arity (ADR-0047), its models
  (`[(open)]`) and its slot directives (ADR-0056), or strict templates reject the parent.
- **React, Solid and Qwik** spell a model as two props (`open`, `onOpenChange`, ADR-0012), and Qwik
  appends `$` to every callback prop. Svelte binds a model with `bind:` and lower-cases an event.
- **Layer 2 of §5.6** (unknown events, models and slots, literals outside a union) reads the
  child's declarations.

Plan §4.1 also says that a non-exported component "still becomes a sibling file in each output",
which ADR-0034 left to M3, and plan §7.8 asks for three-level nesting, recursion and components as
list items. ADR-0047 left a consumer's listeners on components and Angular's `no-output-native`
hazard to M3. ADR-0027 recorded that `ngtscVirtual` cannot see a child it has not loaded yet.

## Decision

**The resolver.**

- `CompileOptions` gains `resolve?: (request: { specifier: string; importer: string }) =>
Promise<ModuleApi | undefined>`. `importer` is the compiling file's `filename`. The result is the
  public API of the imported module: its file (relative to the importer, forward slashes), each
  component's API and each injection key it declares (ADR-0055 gives the shape).
- **It is pure and deterministic (P8).** `compile()`'s output depends only on the source, the
  options and what `resolve` returns. A resolver analyses a file the same way for the same
  contents, and computes the API's `file` per request, relative to that importer.
  It returns APIs, never compiled code, so analysing a child never resolves the child's own
  children, and a cycle cannot make it loop.
- `@unframework/compiler` exports `createFileResolver({ root, readFile })`. It reads the child,
  parses and analyses it up to its declarations (no emit), and caches that analysis by content. The unplugin and
  the harness use it. M5's project graph (§5.10) replaces it behind the same option.
- Without a resolver, or when the file is missing or does not export the imported name, the import
  is UF1202 (`unresolved-import`, ADR-0055). The analyser records the resolved API in the IR
  (`ModuleImport`), so every target emits from the IR alone (P5, P6).

**The source form.** `import Field from "./Field.uf.tsx"` or
`import { Field } from "./Fields.uf.tsx"`, then `<Field … />`. The specifier ends in `.uf.tsx`
(one canonical form, P3). A PascalCase tag names an imported component, a component of the same
module, or the component itself. Anything else is UF3047 (`unknown-component`), with a
did-you-mean.

**How an output imports a child.** Each output imports the child's output file in the same output
tree, at the same relative path as the sources, by the file name its target gives that component:

| Target  | Import                                                               | Output file    |
| ------- | -------------------------------------------------------------------- | -------------- |
| React   | `import Field from "./Field";`                                       | `Field.tsx`    |
| Vue     | `import Field from "./Field.vue";`                                   | `Field.vue`    |
| Svelte  | `import Field from "./Field.svelte";`                                | `Field.svelte` |
| Solid   | `import Field from "./Field";`                                       | `Field.tsx`    |
| Angular | `import Field from "./field";`, `imports: [forwardRef(() => Field)]` | `field.ts`     |
| Qwik    | `import Field from "./Field";`                                       | `Field.tsx`    |
| Astro   | `import Field from "./Field.astro";`                                 | `Field.astro`  |

- That is what `unframework build` writes (§8.4), what the golden trees hold, and what every L3 and
  L4 checker resolves with no extra configuration.
- The script targets keep the child's export kind: a default-exported component is imported as the
  default, any other by name. A markup file always exports its component as the default.
- **A non-exported component is a sibling file** (§4.1), named and imported like any other. Its
  script output exports it by name, so its siblings can import it; the module's public exports
  (`UfModule.exports`) do not list it, and M6's barrels leave it out.
- **Recursion.** A component may render itself. React, Solid and Qwik refer to their own function;
  Vue and Svelte import their own file (`import Tree from "./Tree.vue"`), because a virtual id's
  file name is not the component's name (ADR-0021); Angular uses its own selector, which ngtsc
  accepts without `imports` (ADR-0056); Astro uses `Astro.self`. Termination is the author's: a
  recursion renders under a condition. Two modules that render each other work through ES module
  cycles. Angular lists every imported component through `forwardRef` (`imports: [forwardRef(() =>
Field)]`): standalone components that import each other without it fail when they load
  (`ReferenceError: Cannot access 'A' before initialization`), and the API carries no imports to
  tell a cycle apart, so every import takes the form that survives one, of any length. The same
  holds for a child's slot directives (ADR-0056), which the parent lists beside it:
  `imports: [forwardRef(() => Field), forwardRef(() => FieldTitle)]`.

**Components as list items and branch content.** `ForNode.body` widens to
`ElementNode | ComponentNode`: `items.map((item) => <Item key={item.id} label={item.label} />)`.
The key comes off the component as it comes off an element (ADR-0036). An `If` branch may hold a
component. Angular's limit on what a component's root may be inside a list or a table is ADR-0056's.

**Listeners on components.** `onClear={handler}` on a component listens to an event the child
declares with `defineEmits`. The handler is a local function or an arrow function, as on an
element (ADR-0047); its parameters are the event's payload, never a DOM event. An `onX` that the
child does not declare is UF3036 (`unknown-event`, layer 2): a component passes no native listener
through to its root. An option suffix (`onClearOnce`) is UF3043. Each target spells the listener
as its event naming says (ADR-0012), and Angular renames an output named like a native DOM event
(ADR-0056).

**The unplugin.**

- **Module ids.** The id of a file's main component (its default export, or its only exported
  component) stays `<abs>/X.uf.tsx<suffix>` (ADR-0021). Any other component of the file loads as
  `<abs>/X.uf.tsx.<output file>`, such as `/src/Card.uf.tsx.CardIcon.vue` or
  `/src/Card.uf.tsx.card-icon.ts`, which ends in the extension the framework's plugin claims. A
  script target's main id still joins every component of the file (ADR-0021), and the join leaves
  out an import of a file of the same compile.
- **Resolving an output's import.** A relative import from one of the plugin's modules that names
  no file on disk is looked up in the importer's compile, which lists each child it resolved and
  the output path it imports it by. It resolves to the child's main id when the child is its file's
  main component, and to its component id otherwise, so an application never loads two copies of
  one component.
- **The watch edge.** A parent's output depends on its children's APIs, so the transform of a
  parent's module calls `this.addWatchFile(child)` for each resolved child, beside the edge to its
  own file. An edit to `Field.uf.tsx` invalidates `Form`'s module, and `vitest --watch` reruns
  `Form`'s specs. The resolver's cache is keyed by content, so an edit that leaves the API alone
  recompiles the parent to the same bytes.
- **Angular.** `ngtscVirtual` resolves a relative import of a virtual module with Vite
  (`this.resolve`), maps it to the child's virtual id in its in-memory host, and loads every child
  before it compiles the parent (`this.load`), so `getCompiled` knows it (ADR-0027's negative).

## Consequences

**Positive:**

- `compile()` stays one pure function of its input; the resolver is an input like the source.
- Every output tree is self-contained and checks as it is: no checker, `paths` mapping or loader
  knows about `.uf.tsx`.
- The IR snapshot shows what each child declared when the parent compiled, so a reviewer sees why
  an output changed.

**Negative:**

- A parent recompiles when a child's API changes; the unplugin's watch edge and the content-keyed
  cache keep that cheap, but `compile()` callers that cache by source alone are wrong now.
- The unplugin has two id forms and a lookup through the importer's compile. M6 ports both to the
  other bundlers.
- `createFileResolver` analyses each child's declarations again in every process. M5's graph
  shares them.

**Open:**

- M5: the project graph replaces `createFileResolver`, and reports cycles longer than two modules.
- M6: whether a host application may import a markup target's non-main component by name
  (`import { IconButton } from "./Buttons.uf.tsx"` in a Vue app); outputs never need it.

## Alternatives considered

- **Outputs import the source specifier (`./Field.uf.tsx`).** It needs nothing new in the unplugin,
  and ADR-0021's `ngtscVirtual` already maps it. But no checker resolves it in a golden tree, and
  `unframework build` would rewrite every import, so the reviewed output would not be the shipped
  one.
- **A query per component (`X.uf.tsx.vue?uf=CardIcon`).** plugin-vue and vite-plugin-svelte key
  their descriptor caches by the path without the query, so two components of one file would
  share a cache entry.
- **The whole project graph now (§5.10).** Incremental invalidation and type dependencies are M5's
  (plan §5.10, §9 M5); the resolver is the part M3 needs, behind the option M5 keeps.
- **The child's full IR as the resolver's result.** It ties the parent's compile to every detail of
  the child's setup and grows each `ir.json`; the API is what a parent reads.

## Evidence

The spikes ran in a scratch worktree of this repository at `5dc4baf`, with hand-written outputs
in place of the compiler's: a harness plugin swapped each stub's output for them, and a resolver
plugin mapped an output's import of a sibling output to the sibling's module id, as this record's
unplugin does. Versions are the catalog's: Vite 8.3.1, Vitest 5.0.3, React 19.3.0 with
babel-plugin-react-compiler 1.0.0, Vue 3.5.43 with vue-tsc 3.3.11, Svelte 5.57.1 with
svelte-check 4.7.6, Solid 1.9.15, Angular 22.2.1 (compiler-cli on `@typescript/typescript6`
6.0.2), Qwik 2.0.0-beta.47, Astro 7.3.5 with `@astrojs/check` 0.9.10, TypeScript 7.0.2 (tsgo).

- **Cases.** `spike/form`: `Form` renders two `Field`s, with a prop, an event, a bound and an
  unbound model, the default slot with fallback, a scoped slot and `class` fallthrough.
  `spike/list` and `spike/table`: a component as a `.map` root (`<li>`, `<tr>`). `spike/hazard`:
  an event named `change` (ADR-0056).
- **Commands**, from the worktree, each with `UF_TARGETS=vue,<t>`:
  `pnpm --filter @unframework/integration test -- --project "toolchain:<t>" -t 'spike/'`, the same
  with `--project "ssr:<t>"`, and with `--project "browser:vue" --project "browser:<t>" cases/spike`
  (L10's live mode needs the reference's capture in the same run).
- **Through each framework's Vite plugin and checker:**
  - Vue: `form`, `list`, `table` and `hazard` pass L3 to L13, the parent's virtual module importing
    `./Field.vue` and the resolver answering with `…/Field.uf.tsx.vue`.
  - React, Solid and Qwik: `import Field from "./Field"` resolves in tsgo with the toolchains'
    `moduleResolution: "bundler"` and through Vite. Every case passes L3 to L5, L6 and the browser
    layers, apart from the cells ADR-0058 normalises (React's `value` attribute, Qwik's
    `q:template`).
  - Svelte: every cell of the four cases passes.
  - Astro: L3 to L6 pass. The browser project's render server cannot load a child
    (`Failed to load url ./Field.astro (resolved id: ./Field.astro) in …/Form.uf.tsx.astro`): it
    compiles only the module a spec imports. ADR-0057 gives it the unplugin's resolution.
  - Angular, without the `ngtscVirtual` change, in both the SSR and the browser project:
    `List.uf.tsx.ts(3,18): error TS2307: Cannot find module './item' or its corresponding type
declarations.` and `error NG1010: 'imports' must be an array of components, directives, pipes,
or NgModules. Value could not be determined statically.` Mapping the import alone gives the
    same error when the parent compiles first. With `this.resolve` and `this.load` of each child
    before the parent's compile, both projects compile every case (what they render is ADR-0056's),
    and `toolchain:angular` passes L3 to L5.
- **Recursion on Angular:** a `Tree` whose template renders `<uf-tree [depth]="depth - 1" />` under
  `@if (depth > 0)`, with no `imports`, passes L3 to L5 and renders three levels in `ssr:angular`.
- **Listeners:** every target delivered `Field`'s `clear` payload to `Form`'s handler (the form
  spec's "binds the model and listens to the event" passes L8 and L9 on the six interactive
  targets).
