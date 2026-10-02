# @unframework/ir

The Unframework intermediate representation: what the analyser knows about a `.uf.tsx` module, as
plain, versioned, schema-validated JSON (plan §5.3).

- **Types:** `UfModule`, `UfComponent`, `UfExport` and the render nodes (`Element`, `Text`) with their
  attributes (`Static`). Later milestones add the rest of the render nodes and the setup items.
- **Builders:** `createModule`, `createComponent`, `createElement`, `createText`, `createStaticAttribute`.
- **Visitors:** `walk` and `collectFeatures`.
- **Schema:** `irSchema` (also `@unframework/ir/schema.json`), generated from the types with
  `pnpm --filter @unframework/ir generate`. A test fails when it is stale. `validateModule` checks
  a value against it without dependencies (the compiler checks what plugins return with it).
- **Invariants:** `checkInvariants` checks what the types document and the schema cannot say:
  component and export names every target can write, HTML elements a component can render, an
  element's own attributes set once, `true` for exactly the boolean attributes, a canonical
  `class`, nothing the targets render differently (`portability.ts`), no code or document the
  compiler cannot analyse (`srcdoc`, `javascript:` URLs, `data:` URLs a frame loads), and only
  characters HTML keeps. The compiler emits from no module that breaks one, a plugin's included.
- **Portability facts:** what the targets render differently from the same markup
  (`portability.ts`): elements Vue does not know, template syntax, attributes a framework acts on
  or sets as state, `contenteditable` with children, empty URLs React drops, whitespace Svelte
  drops. The analyser reports each at its source, and the invariants reject them in any IR.
- **HTML vocabulary:** the elements, attributes and content-model facts the analyser validates
  against, and the printers and targets lay out by (`html.ts`). Its tables are maps, read with
  names from the source. `ID_REFERENCE_ATTRIBUTES` and `idReferencesIn` are how the analyser and
  the tests' normaliser both find id references (the generated-id prefix, ADR-0031).
  `listBoxSize` reads a `<select>` as HTML does: a single-selection list box with an option a
  drop-down would select starts with none selected (the `listbox` capability).

The IR has no dependencies and imports nothing from TypeScript: it is pure data.
