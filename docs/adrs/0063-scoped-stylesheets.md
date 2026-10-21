# ADR-0063: Scoped stylesheets, from the import to each target's attachment

- **Status:** Proposed
- **Date:** 2026-10-21
- **Plan:** §4.4, §5.3, §5.8, §6, §7.2, §7.5, §9 M4, P2, P5, P6, P7, P8; C4 (ADR-0004), D5
  (ADR-0009); amends ADR-0004, ADR-0009, ADR-0021, ADR-0025 and ADR-0053

## Context

ADR-0004 makes a sibling `.css` file a component's stylesheet, scoped once by the compiler and
attached each target's native way. ADR-0009 picks Vue's attribute algorithm for the scoping. Neither
says what the IR holds, how the scope id is made, which selectors the scoper refuses, what file the
targets import, or how a sheet reaches each framework's Vite plugin. M4 builds all of it in several
layers, and each layer needs the same contract before it starts:

- **The IR is the contract (P5).** The analyser fills it, the scoper and the targets read it, and a
  plugin's `ir` hook may return it, so the invariants must say what a styled module may hold.
- **Determinism (P8).** The scope attribute is in every golden file, so its id can't depend on a
  path or a machine.
- **Two ids per child.** The child-root rule stamps a parent's id on a child's root, and
  `:slotted()` stamps a child's id on the content a parent fills into it. A parent sees a child
  only through the resolver's `ComponentApi` (ADR-0053), so that API has to carry the child's id.
- **L3 can't check a sheet.** The toolchain projects hand every emitted file to each framework's
  compiler, checker and linter (ADR-0025). Babel and tsgo fail on a `.css` file, and Vue's
  `<style src>` and Angular's `styleUrl` are skipped by L3: ADR-0025 leaves that open.
- **The style ids differ.** ADR-0021 gives TSX targets `<source>.css`, and leaves Vue, Svelte and
  Astro to their plugins' own style sub-requests, which carry each framework's own scoping.

## Decision

**The IR** (`@unframework/ir`):

- `UfComponent.styles` lists the sheets the component imports, in source order. A `StyleSheet`
  holds the specifier as written (a relative path ending in `.css`), the sheet's text as the
  resolver read it, and the import's span. `UfComponent.scopeId` is set exactly when `styles` is.
- **One sheet owner per module.** A module that imports a sheet declares one component, which owns
  it (UF5001). A sheet that two modules import is scoped by each, under each id: telling them apart
  needs M5's project graph.
- `ComponentApi.styles` is `{ scopeId, slotted }`: the child's id, and whether its sheets use
  `:slotted()`, so a parent stamps `-s` and decides `slotted-styles` from the resolver alone.
- `UfModule.passThroughImports` holds named imports from `virtual:styleframe` and the side-effect
  import `virtual:styleframe.css`, which every output keeps as written (§4.4, ADR-0004). A template
  reads such a name through an `Import` reference, never through a binding. Only a template may
  read one, and the coverage gate counts the kind.
- The invariants check each of these: a scope id exactly with sheets, sheets in a one-component
  module only, names a pass-through import binds that are identifiers no other import binds,
  `virtual:styleframe.css` binding nothing, and an `Import` reference naming one of them, in a
  template only.

**The scope id and the attribute:**

- The attribute is `data-uf-<id>`, and `:slotted()`'s is `data-uf-<id>-s`.
- The id is 8 lower-case hex digits: the 32-bit FNV-1a hash of the UTF-8 bytes of the component's
  name, a NUL, and each sheet's text in import order, each followed by a NUL. No path goes into it,
  so it's the same on every machine and in every target.
- Every element the component's template renders carries it, the slot content it fills into a
  child included. A child component's root carries the parent's attribute too (the child-root rule,
  as Vue's scope id does).

**The rewrites**, which match `@vue/compiler-sfc`'s `compileStyle({ scoped: true })` but for the
attribute's name:

| Source                                        | Scoped                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `.a .b`                                       | `.a .b[data-uf-x]`                                                                         |
| `.a :deep(.b)`                                | `.a[data-uf-x] .b`                                                                         |
| `:global(.b)`                                 | `.b`                                                                                       |
| `:slotted(.b)`                                | `.b[data-uf-x-s]`                                                                          |
| `.a::before`                                  | `.a[data-uf-x]::before`                                                                    |
| `@media`, `@supports`, `@layer`, `@container` | kept, and the rules inside scoped                                                          |
| `@keyframes spin`                             | `@keyframes spin-x`, with `animation` and `animation-name` in the sheet rewritten to match |
| `--gap: 4px`                                  | unchanged                                                                                  |

**Rejected selectors (UF5004):** `:root`, `html` and `body` outside `:global()`, `:host`, a misused
or empty `:deep()`, `:slotted()` or `:global()`, and a selector that tells an empty `class` or
`style` from none (ADR-0044). Vue scopes `:root` and `:host` instead, and the scoped selector then
matches nothing.

**Where the work lives:**

- **The scoper** is in `@unframework/codegen`. It runs lightningcss's `transform` with a visitor
  that rewrites the sheet's selectors, prints a deterministic, non-minified sheet, and returns its
  UF5004 diagnostics. `@unframework/parser` only reports a sheet's parse errors (UF5002).
- **The resolver reads the sheets.** `compile()` asks the resolver's `stylesheet` for each sheet
  before analysis, and the codegen scoper whether it uses `:slotted()`; a sheet it cannot read is
  UF5005. UF5002 and UF5004 point into the sheet, in its file as the resolver names it.
- `compile()` runs the scoper once per sheet, after analysis and the plugins' `ir` hooks and before
  the targets, so it scopes the module the targets emit from, and reports what it returns at the
  selector's span. A hook may keep or drop the analyser's sheets with their scope id, never change
  them. A scoper error withholds the module from every target, as an analyser error does. The
  analyser can't run it: codegen depends on the analyser in its tests.
- **The output file.** Each styled component gets a second `OutputFile` on every target, named
  after its source plus `.css` (`Button.uf.tsx.css`, ADR-0021's id for TSX targets). Every output
  refers to it as `./<source>.css`, so it never collides with the author's `./Button.css`, which is
  never loaded.
- **The unplugin serves it** on every target. `resolveId` takes `./<source>.css` relative to any
  `.uf.tsx` virtual id, before the child-output lookup, and never enters it in `owners`. `load`
  returns the sheet this target's compile emitted, also for plugin-vue's
  `?vue&type=style&index=0&src=true&lang.css` request (the unplugin runs `enforce: "pre"`) and for
  Qwik's `?inline` import from a segment module. The id ends in `.css`, without a `\0` prefix, so
  Vite's CSS pipeline handles it, `?inline` included.
- The shared JSX and markup builders print the attributes, so a target owns only its attachment and
  its `child-root-scope` and `slotted-styles` cells (P6).

**Each target's attachment:**

| Target               | Attachment                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Vue                  | `<style src="./<source>.css">`, without `scoped`: plugin-vue resolves it through the unplugin               |
| React, Solid, Svelte | `import "./<source>.css"`                                                                                   |
| Astro                | an import in the frontmatter, or an inline `<style is:global>`: its lane settles ADR-0020's open item       |
| Angular              | `styleUrl: "./<source>.css"` with `ViewEncapsulation.None`, read through ngtsc's resource loader (ADR-0027) |
| Qwik                 | `import styles from "./<source>.css?inline"` and `useStyles$(styles)`                                       |

An output that imports the sheet type-checks only with `declare module "*.css" {}` (ADR-0023), and
`*.css?inline` for Qwik: each lane adds the declaration to the toolchain's checked files.

**The lightningcss check stands in for L3.** The toolchain projects leave emitted `.css` out of what
they hand the frameworks' compilers, checkers and linters. The compile project parses every emitted
sheet with `parseStylesheet` instead, Vue's and Angular's included.

**The capabilities:** `scoped-styles` (a component with a sheet), `child-root-scope` (a child a
styled component renders) and `slotted-styles` (content filled into a child whose sheet uses
`:slotted()`). Each target declares all three `native`, the cell its lane is expected to reach. A
lane that can't reach it declares the cell `emulated` or `unsupported`, with the next free UF4 code,
and adds a section here.

**The codes** are UF5001 `shared-stylesheet`, UF5002 `invalid-stylesheet`, UF5003
`unsupported-stylesheet-language` (`.scss`, `.sass`, `.less`, `.styl` and `.pcss`, which are UF1002
until it lands), UF5004 `unscopable-selector`, UF5005 `stylesheet-not-found` and UF5006
`unsupported-styleframe-import`. All are errors.

A `Button` whose `Button.css` holds `.label { color: red }` and a line feed has the id
`70af206b`:

```text
Source   import "./Button.css";
         <button class="button"><span class="label">{text}</span></button>
Sheet    .label[data-uf-70af206b] { color: red }          (Button.uf.tsx.css)
React    import "./Button.uf.tsx.css";
         <button className="button" data-uf-70af206b><span className="label" data-uf-70af206b>
Vue      <style src="./Button.uf.tsx.css"></style>
```

## Consequences

**Positive:**

- Every target receives one sheet, byte for byte, so pixel parity tests the compiler, not seven
  scoping implementations.
- The scope id follows the component and its CSS, never the file's place, so goldens are stable on
  every machine.
- A parent reads all it needs of a styled child from the resolver, with no runtime (P7).
- Emitted sheets are checked by a real CSS parser on every target, which closes ADR-0025's open item.

**Negative:**

- A 32-bit id can collide. Two components share one when they have the same name and the same
  sheets, or by chance, which becomes an even bet only among about 77,000 styled components. Then
  each component's rules also match the other's elements.
- Two components can't share a sheet in one module, and two modules that import one sheet ship it
  twice.
- Every rendered element carries one more attribute, and each scoped selector gains its
  specificity, as in Vue.
- Until the analyser lowers them, the IR admits shapes no target emits yet: a plugin's IR with a
  sheet compiles to outputs without it.

**Open:**

- Astro's attachment: an import that the Container API collects, or an inline `<style is:global>`
  (its lane, ADR-0020).
- Each lane's `child-root-scope` and `slotted-styles` cells on React's children, Svelte's snippets,
  Angular's projection and Qwik's `<Slot />`, recorded here as they settle.
- No watch or HMR edge runs from the author's `X.css` to its sheet module until M6.
- A sheet that two modules import is not yet a diagnostic: detecting it needs M5's project graph,
  and until then each module scopes its own copy.

## Amendments

- **ADR-0004.** The attachment table names the emitted `./<source>.css`, never the author's
  `./Button.css`. Vue's `<style src>` has no `scoped`, and Qwik's import is `?inline`. A module that
  imports a sheet declares one component. "A stylesheet imported by two components is a
  diagnostic" holds within a module only (UF5001): a sheet that two modules import is scoped by
  each, until M5's project graph can see both.
- **ADR-0009.** The id is FNV-1a over the name and the sheets' text. `:slotted()` uses
  `data-uf-<id>-s`, which the parent stamps at compile time. `@keyframes` names take the id, and
  the selectors above are UF5004.
- **ADR-0021.** Every target's style id is `<source>.css`, served by the unplugin: Vue and Svelte
  no longer use their plugins' own style sub-requests for a component's sheet, and Astro not its
  own.
- **ADR-0025.** L3 never sees an emitted sheet: the compile project's lightningcss check covers
  every target's.
- **ADR-0053.** The file resolver reads a child's stylesheets too, for the scope id and the
  `:slotted()` use its API carries, and caches the child's analysis by their text as well. A
  child's own `.uf.tsx` imports are still never resolved.

## Alternatives considered

- **A hash of the file's path, as Vue does.** It changes with the checkout's place and the
  relative path the caller passes, which P8 rules out, and every target would need the same path.
- **A longer id.** Sixteen hex digits make a collision negligible, but every element carries the
  attribute, and Vue's eight digits have served its users. The hash can grow with a new ADR.
- **The scoper in the analyser.** The analyser would then depend on codegen, which already depends
  on the analyser in its tests. `compile()` runs the scoper between the two instead.
- **The sheet as a query on the `.tsx` id** (`?uf&type=style&lang.css`). Vite filters on the path
  without its query, so Solid's babel and Vite's oxc parse it as TSX (ADR-0021).
- **Each framework's own style blocks** (`<style scoped>`, Svelte's `<style>`, Angular's
  emulated encapsulation). Each scopes differently, and Svelte drops selectors it can't match
  statically (§4.4, ADR-0004).
