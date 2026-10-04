# @unframework/ir

The Unframework intermediate representation: what the analyser knows about a `.uf.tsx` module, as
plain, versioned, schema-validated JSON (plan §5.3).

- **Types:** `UfModule` (its components, exports and the local type declarations their props use),
  `UfComponent` (props, the props parameter, bindings, and a render root that is an element or a
  root `Fragment`), the render nodes (`Element`, `Text`, `Interpolation`, `If`, `For`) and the
  attribute kinds (`Static`, `Bound`, `Class`, `Style`, `Spread`). An `Expression` is the source
  text at its span, with every identifier resolved to a `Binding` (a prop or a loop variable, by
  its `name@offset` id) or an allowed global. Later milestones add the setup items and the other
  binding and node kinds.
- **Builders:** one per type (`createModule`, `createComponent`, `createElement`, `createFor`,
  `createExpression`, …). They write keys in the order of the types, which is the order of every
  `ir.json` snapshot, and leave an absent optional field out.
- **Visitors:** `walk` (every container, the root fragment included), `childrenOf`,
  `collectFeatures` (node, attribute and binding kinds, which the coverage gate reads),
  `expressionsOf` (every expression of a component with its JSON Pointer) and `spansOf` (every
  span of a module).
- **Schema:** `irSchema` (also `@unframework/ir/schema.json`), generated from the types with
  `pnpm --filter @unframework/ir generate`. A test fails when it is stale. `validateModule` checks
  a value against it without dependencies (the compiler checks what plugins return with it): a
  node's `kind` picks its branch of a union, and a key set to `undefined` is absent, as in JSON.
- **Invariants:** `checkInvariants` checks what the types document and the schema cannot say:
  component and export names every target can write; HTML elements a component can render, and
  SVG elements inside an `<svg>`; an element's own attributes, set once across every kind (a
  spread's `class` merges with the element's); `true` for exactly the HTML boolean attributes; a
  canonical `class` and a `style` whose declarations do not overlap; nothing the targets render
  differently (`portability.ts`), bound or static; no code or document the compiler cannot
  analyse (`srcdoc`, `javascript:` URLs, `data:` URLs a frame loads); text where every target
  renders it alike, with only characters HTML keeps; props every target can declare, with static
  defaults; bindings in scope, and expressions that fill their spans; and the shapes of
  conditionals, lists and fragments. The compiler emits from no module that breaks one, a
  plugin's included, and checks itself that a plugin's expressions are the analyser's.
- **Portability facts:** what the targets render differently from the same markup
  (`portability.ts`): elements Vue does not know, template syntax, attributes a framework acts on
  or sets as state, `contenteditable` with children, empty URLs React drops, whitespace Svelte
  drops, attributes Angular cannot bind, text the parser moves or drops. The analyser reports each
  at its source, and the invariants reject them in any IR.
- **Vocabulary:** the HTML elements, attributes and content-model facts the analyser validates
  against, and the printers and targets lay out by (`html.ts`), with the boolean attributes a value
  can be bound to and the attributes React and Qwik type as numbers; the SVG elements and
  attributes, case-exact (`svg.ts`); CSS facts: unitless properties, shorthands as Chromium
  expands them, and what a static value may hold (`css.ts`); the allowed globals and the reserved
  prop names (`names.ts`). Its tables are maps, read with names from the source.
  `ID_REFERENCE_ATTRIBUTES` and `idReferencesIn` are how the analyser and the tests' normaliser
  both find id references (the generated-id prefix, ADR-0031). `listBoxSize` reads a `<select>` as
  HTML does: a single-selection list box with an option a drop-down would select starts with none
  selected (the `listbox` capability), and what is known only at run time counts as one.

The IR has no dependencies and imports nothing from TypeScript: it is pure data. The tables say
where each comes from; the analyser's conformance tests check them against the frameworks and
parse5.
