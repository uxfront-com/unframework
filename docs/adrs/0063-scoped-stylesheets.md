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
attribute's name, and for the forms whose rewrite by Vue doesn't parse or names keyframes that no
longer exist:

| Source                                        | Scoped                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `.a .b`                                       | `.a .b[data-uf-x]`                                                                         |
| `.a :deep(.b)`                                | `.a[data-uf-x] .b`                                                                         |
| `:global(.b)`                                 | `.b`                                                                                       |
| `:slotted(.b)`                                | `.b[data-uf-x-s]`                                                                          |
| `.a::before`                                  | `.a[data-uf-x]::before`                                                                    |
| `* + *`, `* > .a`                             | `* + *[data-uf-x]`, `* > .a[data-uf-x]`: Vue drops the `*`, and its selector doesn't parse |
| `@media`, `@supports`, `@layer`, `@container` | kept, and the rules inside scoped                                                          |
| `@keyframes spin`                             | `@keyframes spin-x`, with `animation` and `animation-name` in the sheet rewritten to match |
| `@keyframes "spin"`                           | `@keyframes "spin-x"`, which `animation: spin` names too: Vue writes `"spin"-x`            |
| `--gap: 4px`                                  | unchanged                                                                                  |

**Rejected selectors (UF5004):** `:root`, `html` and `body` outside `:global()`, `:host`, a
namespace prefix (`svg|`, `*|`: Vue drops the prefix of `svg|*` and `*|*`, so the compiler scopes
no prefixed selector rather than some), a misused or empty `:deep()`, `:slotted()` or `:global()`
(`:slotted()` in a rule with nested rules or under `:deep()`, where Vue drops `-s` or writes `.a*`,
and a selector beside a `:deep()` one in a rule with nested rules, which Vue leaves unscoped,
included), an empty `:is()` or `:where()`, and a selector that tells an empty `class` or `style`
from none (ADR-0044). Vue scopes `:root` and `:host` instead, and the scoped selector then
matches nothing.

**Where the work lives:**

- **The scoper** is in `@unframework/codegen`: Vue's scoped plugin, ported onto the parsers Vue
  uses, postcss and postcss-selector-parser, both pinned exactly (P8). They keep the sheet's own
  text, so only the selectors and the keyframe names change, and every declaration, custom
  properties included, reaches the targets as written. It returns its UF5004 diagnostics, and
  UF5002 for a sheet postcss cannot read. lightningcss only checks that the sheet parses:
  `@unframework/parser` reports its parse errors and the at-rules it does not know (UF5002), whose
  rules would otherwise reach the page unscoped. This amends plan §4.4's "lightningcss parses and
  rewrites the selectors": lightningcss's printer drops a declaration a later one overrides and
  rewrites values, and it gives no spans to splice into the author's text.
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

**Emission**, as built:

- **The attributes.** The shared JSX and markup builders print each one as `data-uf-<id>=""`
  after an element's own attributes: a bare JSX attribute is `true`, which React writes as
  `"true"`, and an empty value renders the same on every target. A child component's tag takes
  its styled parent's attribute, whether or not the child is styled; each lane settles how the
  child's root takes it (`child-root-scope`). The content a parent fills into a child whose
  sheets use `:slotted()` takes the child's `-s`, read from the resolver's API or, for one of the
  module's own components, from its sheets: every element and component tag of the fill, but not
  the content of a fill nested inside it, which takes only its own child's. A `<component is>`'s
  fills take the `-s` of each candidate that has one, so every target writes the same DOM.
- **The output file.** `compile()` scopes a component's sheets and joins them in import order,
  with a line feed between two only where the first lacks one. The file follows the target's
  own files, so `output` hooks see it, and `formatOutput` returns a `.css` file as it is.
  `CompileResult.owners` leaves it out: it is no component's module.
- **The unplugin.** `resolveId` takes `./<source>.css` only from one of its own modules or a Qwik
  segment, and an absolute or root-relative sheet id coming back, each with its query, and
  answers `/abs/<source>.css` when the `.uf.tsx` file exists. `load` serves the sheet from the
  compile cache for any query, and fails a sheet id whose file imports no stylesheet.
- **The checks.** The toolchain projects drop emitted `.css` paths from their file lists after a
  canary's compile writes them, since Angular's checks read a `styleUrl` from the disk. The
  compile project parses every emitted sheet with `parseStylesheet`, as part of L2, and fails one
  with an error or an unknown at-rule.

**React and Solid**, as built:

- **The attachment.** The output imports its sheet for its side effect, `import "./Card.uf.tsx.css"`,
  after its other imports, so a child's sheet loads before its parent's, as plugin-vue imports a
  component's style after its script. The toolchain projects hand the checker a
  `declare module "*.css" {}` file from the target's toolchain package (`sheets.d.ts`), and every
  toolchain's lint baseline allows a `.css` import that binds nothing
  (`import/no-unassigned-import`).
- **`child-root-scope`, emulated (`scopeAttributes`).** The parent passes its attribute on the
  child's tag, `<Button data-uf-a33d603f="" />`, which a typed JSX consumer may write, since JSX
  checks no hyphenated name. Each name is a parent's id, which the child can't know, so every
  component that takes `class` and `style` (ADR-0054) spreads an inline helper's pick of them on
  its root: `{...scopeAttributes(attributes)}`, from the rest of a React props pattern, or from the
  props object (`props` on Solid, and React's object form). The helper keeps only the props'
  `data-uf-*` keys, each with the empty value the parent writes, and reads no value, so it runs no
  Solid getter, and no prop the output leaves unread reaches the root, as a bare rest spread would
  let it. A root component spreads them on, so they reach the first element, as Vue's scope id
  does. Each component of a module takes the helper under a name of its own
  (`scopeAttributes_1`), because the unplugin joins them into one module (ADR-0053).
- **The cost on Solid.** A spread on the root makes Solid's compiler set the root's attributes
  through `spread` and `mergeProps`, and render it on the server with `ssrElement`, instead of a
  template and `ssrHydrationKey()`. The hydration key is still written. `ssrElement` writes `class`
  for a key that holds nothing and a space after a class (`class="card "`), as it writes
  `style=""`: the server HTML differs from Vue's in an empty `class` and the class's whitespace,
  which hydration sets right and the normaliser reads as the same (ADR-0044).
- **`slotted-styles`, native.** The shared JSX builder stamps the child's `-s` on the content a
  parent fills in, so it holds on `children`, named slot props and render props, whose function
  returns the stamped content.
- **Not covered.** A child whose root is a conditional, a list or a fragment, and one with
  `inheritAttrs: false`, takes no `class`, `style` or scope attribute, so a parent's sheet does
  not reach its root on React and Solid. Vue gives the scope id to a conditional's rendered root
  and to a root with `inheritAttrs: false`, so those two differ, and no diagnostic says so yet:
  `ComponentApi.root` does not tell a conditional from a fragment, which no target scopes.

**The capabilities:** `scoped-styles` (a component with a sheet), `child-root-scope` (a child a
styled component renders) and `slotted-styles` (content filled into a child whose sheet uses
`:slotted()`). Each target declares all three `native`, the cell its lane is expected to reach. A
lane that can't reach it declares the cell `emulated` or `unsupported`, with the next free UF4 code,
and adds a section here.

**The codes** are UF5001 `shared-stylesheet`, UF5002 `invalid-stylesheet`, UF5003
`unsupported-stylesheet-language` (`.scss`, `.sass`, `.less`, `.styl` and `.pcss`), UF5004
`unscopable-selector`, UF5005 `stylesheet-not-found` and UF5006 `unsupported-styleframe-import`. All are errors.

A `Button` whose `Button.css` holds `.label { color: red }` and a line feed has the id
`70af206b`:

```text
Source   import "./Button.css";
         <button class="button"><span class="label">{text}</span></button>
Sheet    .label[data-uf-70af206b] { color: red }          (Button.uf.tsx.css)
React    import "./Button.uf.tsx.css";
         <button className="button" data-uf-70af206b=""><span className="label" data-uf-70af206b="">
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
- Until each target attaches its sheet, a styled module's outputs carry the sheet and the
  attributes, but no output loads the sheet.

**Open:**

- Astro's attachment: an import that the Container API collects, or an inline `<style is:global>`
  (its lane, ADR-0020).
- Each lane's `child-root-scope` and `slotted-styles` cells on Svelte's snippets, Angular's
  projection and Qwik's `<Slot />`, recorded here as they settle. React's and Solid's are above.
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

- **lightningcss's `transform` and printer**, as plan §4.4 first said. It prints its own CSS: it
  drops `height: 100vh` before `height: 100dvh`, rewrites `#ff0000` and custom properties, and its
  visitor cannot read some values back (`calc(infinity * 1px)`). A splice into the author's text
  needs a reader of its own, which lightningcss's tree, without spans, cannot give.
- **A hand-written CSS reader** that splices the rewrites into the text. Each review round found
  new edge cases of CSS Syntax in it (escapes, `url()`, line continuations), each silent. postcss
  and postcss-selector-parser have handled them for Vue for years.
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
