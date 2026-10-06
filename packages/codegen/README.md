# @unframework/codegen

The target kit (plan §5.8): everything a target needs to emit idiomatic code, and nothing
framework-specific.

- **`defineTarget`** and the `Target` interface: `name`, `framework`, a capability matrix and
  `emit(component, context)`. The matrix has a cell for every name in `CAPABILITY_NAMES`: one per
  IR node and attribute kind (`element`, `text`, `interpolation`, `conditional`, `list`,
  `static-attribute`, `bound-attribute`, `class-binding`, `style-binding`, `attribute-spread`),
  plus `props`, a root `fragment`, `svg`, `listbox` and `interactivity`. Each cell is `native`,
  `emulated` with the name of the inline helper the target prints (React's `cx` for
  `class-binding`), or `unsupported` with a portability diagnostic: a target declares in its
  matrix what it cannot render exactly (P4, ADR-0033). `requiredCapabilities` derives what a
  module uses from its IR, with where each capability is first used: the compiler's capability
  check and the render-parity tests read it.
- **Expressions** (`rewriteExpression`, design §4.1): an IR expression keeps its source text, and a
  target prints it by splicing its own spelling of each reference (`RewriteRules`: Solid's
  `props.label`, and Angular's `this.label()` in a list's `track`, which reads no template variable;
  elsewhere Angular reads the `@let label = this.label();` it declares, as written) at the
  reference's span, expanding a shorthand property whose spelling changes. Everything else stays as
  the author wrote it: literals, spacing and comments. Expressions are never re-printed from an AST,
  since oxc-codegen writes `1000` as `1e3` and drops comments. `parseExpression` (through
  `@unframework/parser`) only checks that code is one expression and gives its AST with offsets
  relative to the code; `needsParentheses` says whether code needs parentheses in a slot (an
  operand, a conditional's test, an argument); `referencedBindings` gives the bindings the printed
  expressions read, so targets leave out an unused destructured prop or list index (L5).
- **JS and JSX:** ESTree builders (`js.*`: patterns, type annotations and type arguments, class
  fields with modifiers, members and optional chains, operators, JSX elements, fragments and
  spreads) printed with oxc-codegen (`printModule`, `printProgram`, `printExpression`). Code
  copied from the source enters an AST only through `Placeholders` (an expression or a type
  slot), spliced as written once the module is printed, or as text joined between printed
  pieces: `printComponentModule` prints a JSX target's file as its imports, the copied type
  declarations, the component and its inline helpers. `jsxNode(node, jsxContext(…))` writes any
  render node as JSX. Its defaults are React's (ternary chains ending in `null`, never `&&`;
  `.map` with the `key` first and the index only when read; `<>…</>` for several nodes; `{expr}`
  and `name={expr}`; class parts as an array; style objects with camelCase keys; a spread as
  one attribute per declared key, its `class` merged into the element's), and a `JsxDialect`
  overrides attribute names, expressions, conditionals, lists and each attribute kind. Text
  goes through `jsxText`, the JSX escaping contract (ADR-0030): raw only when every JSX
  transform and formatter keeps it as written, and never where a formatter could start a line
  with `//` or `/*`.
- **Rendered values as one string** (`src/js/text.ts`), for a target whose framework takes one
  string where the source has several parts (React's and Qwik's SVG `<title>`, ADR-0040):
  `textTemplate` joins texts and expressions into a template literal, escaped so the string is
  exactly the text; `nullishText` writes a value as an interpolation renders it, with `?? ""`
  only where `syntacticNullishness` (TypeScript's own reading, checked against tsgo in the tests)
  says it may be nullish, since `??` elsewhere fails L4 (TS2869, TS2871), a nullish `??`
  fallback as `""`, and nothing for a value that always renders nothing (`isAlwaysNullish`).
  Which parts to join and which values are already text stay the target's.
- **Markup** (`src/markup/`, design §4.3): `printMarkup(render, dialect, { component, rewrite })`
  prints a component's root element or fragment, every node and attribute kind, with a dialect per
  template language (`vueDialect`, `svelteDialect`, `angularDialect`, `astroDialect`, and
  `htmlDialect` for static HTML). The generic printer (`markup/printer.ts`) walks the IR, spells
  each expression with the target's `RewriteRules`, reads a spread key by key (its `class` merged
  into the element's), and lays out lines; each dialect (`markup/<language>.ts`) decides how its
  language writes text, interpolations, bound attributes, class, style, conditionals and lists, and
  escapes code for what its template scanner reads inside it (Vue's `}}` and character references;
  Angular's lexers, whose literals it re-prints, whose comments it drops, and for which it escapes a
  regular expression's quotes, `;`, lone parentheses and `//`; Svelte and Astro read balanced
  JavaScript). A dialect may also rename an element whose content its language reads by name
  (`elementName`: Angular's `<svg:title>`). Vue's and Angular's compilers parse a static `style`
  again: Vue's dialect binds a declaration its parser would misread (a `;` in a string), and
  Angular's refuses one, which the analyser rejects (UF3022). Text is written so its compiler builds
  exactly the IR's DOM: delimiters escaped, whitespace the compiler would collapse or drop written
  as something it keeps (with `TextPosition` saying where the text sits: its element, its container,
  its neighbours), text at the root's edges protected from the whitespace a target puts around the
  markup. Line breaks only go where the whitespace they create cannot reach the DOM: between
  elements and blocks and at content edges where the compiler drops it, inside a tag or after a
  block's closing where it does not (Svelte); text and interpolations hug their neighbours, and a
  `<title>`'s content stays on its tag's line, since Astro keeps its whitespace. Childless SVG
  elements close themselves. The targets' `markup-semantics` tests render the shared
  cases of `test/markup-cases.ts` through each framework and its L5 linters.
- **Formatting:** `formatOutput` runs oxfmt (pinned) over code files (TS, TSX, JS), with
  embedded-language formatting off and objects laid out by width alone. In a markup file it
  formats only the TypeScript blocks, each as TypeScript on its own (ADR-0041): a `.vue` file's
  `<script lang="ts">` blocks, a `.svelte` file's (indented two spaces, except a literal's own
  lines) and an `.astro` file's frontmatter. The markup (Vue, Svelte, Astro, HTML, and Angular's
  inline template) keeps the printer's whitespace-safe layout (ADR-0026). Formatting is
  idempotent and never throws: a block that does not parse comes back as an error.
- **Exports, imports and names:** `exportDeclaration` keeps the source's export shape, for a
  function, a class or an expression (`export const Card = component$(…)`); `componentTypes`
  and `typeDeclarationCode` copy the type declarations a component's props reach, exported as
  the source does. `ImportSet` sorts imports and renames one that clashes with a name in its
  `NameScope`: a target reserves the source's names (`sourceNames`: the component, its types,
  bindings and every variable its expressions read or declare) and claims its own (`props`,
  `cx`, `Show`) from the same scope, so nothing it adds captures or shadows the author's code
  (design §4.2). `kebabCase`, `pascalCase`.
- **The HTML, SVG and CSS vocabulary** (`VOID_ELEMENTS`, `BINDABLE_BOOLEAN_ATTRIBUTES`,
  `NUMBER_TYPED_ATTRIBUTES`, `SVG_ELEMENTS`, `UNITLESS_PROPERTIES`, …) is re-exported from
  `@unframework/ir`, so targets share one copy through the kit.
- **The mount adapter** (`MountAdapter`, in the toolchain contract's types): a target's
  `…/toolchain/client` mounts a compiled component in the browser and returns a
  `MountedComponent` with `settle()`, `rerender(props)` and `unmount()`, and the console messages
  a render outside the page logged (`RenderReport`: Astro renders on the server, at mount and at
  each rerender). `rerender` renders the component again as a parent would, replacing its props
  whole: a prop the new props lack takes its default (Angular, whose inputs cannot be unset, sets
  it to `undefined`, which the emitted input's transform turns into the default). Like the
  mount, it resolves once the framework has settled (ADR-0043).
- **`@unframework/codegen/toolchain-node`** (Node only, never imported by the main entry): what
  the targets' toolchains share, since targets cannot import each other. `resolveInstalled` and
  `resolveToolBin` find tools in a toolchain directory without NODE_PATH; `runChecker` runs a
  checker over a temporary tsconfig that extends the toolchain's, with `diagnosticsByFile` and
  `checkerFailed` to read its output; `typecheckWithTsgo` is L4 for the TSX targets. L5
  (ADR-0042): `lintWithOxlint` runs oxlint with the toolchain directory's
  `output.oxlintrc.json` (the shared baseline, and the JSX targets' framework rules),
  `lintWithEslint` runs ESLint's API with its `eslint.config.js` (the template languages), and
  `mergeLintResults` joins the two. Both reject a linter that cannot start or load its
  configuration or plugins, skips a file, or prints output they cannot read, and return every
  message by file in a stable order.
