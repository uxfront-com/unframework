# @unframework/codegen

The target kit (plan §5.8): everything a target needs to emit idiomatic code, and nothing
framework-specific.

- **`defineTarget`** and the `Target` interface: `name`, `framework`, a capability matrix and
  `emit(component, context)`. A target declares in its matrix what it cannot render exactly
  (P4), and `requiredCapabilities` derives what a module uses from its IR, with where each
  capability is first used: the compiler's capability check and the render-parity tests read it.
- **JS and JSX:** ESTree builders (`js.*`) printed with oxc-codegen (`printModule`,
  `printProgram`, `printExpression`), and `jsxElement`, which writes IR as JSX with each JSX
  target's attribute names.
- **Markup:** `printMarkup` with a dialect per template language (`vueDialect`,
  `svelteDialect`, `angularDialect`, `astroDialect`, `htmlDialect`). Each dialect writes text and
  whole attributes so its compiler builds exactly the IR's DOM: it escapes its own delimiters,
  writes whitespace the compiler would collapse or drop as something it keeps, and binds a value a
  static attribute cannot express. Line breaks only go where the whitespace they create cannot
  reach the DOM.
- **Formatting:** `formatOutput` runs oxfmt (pinned) over code only (TS, TSX, JS), with
  embedded-language formatting off. Markup (Vue, Svelte, Astro, HTML, and Angular's inline
  template) keeps the printer's whitespace-safe layout (ADR-0026).
- **Exports, imports and names:** `exportDeclaration` keeps the source's export shape;
  `ImportSet` sorts imports and renames one that clashes with the module's own names;
  `kebabCase`, `pascalCase`.
- **The HTML vocabulary** (`VOID_ELEMENTS`, `BOOLEAN_ATTRIBUTES`, …) is re-exported from
  `@unframework/ir`, so targets, which import only ir and codegen, share one copy.
- **`@unframework/codegen/toolchain-node`** (Node only, never imported by the main entry): what
  the targets' toolchains share, since targets cannot import each other. `resolveInstalled` and
  `resolveToolBin` find tools in a toolchain directory without NODE_PATH; `runChecker` runs a
  checker over a temporary tsconfig that extends the toolchain's, with `pathKeys`, `resultsFor`
  and `checkerFailed` to read its output; `typecheckWithTsgo` is L4 for the TSX targets.
