# @unframework/codegen

The target kit (plan §5.8): everything a target needs to emit idiomatic code, and nothing
framework-specific.

- **`defineTarget`** and the `Target` interface: `name`, `framework`, a capability matrix and
  `emit(component, context)`. The matrix has a cell for every name in `CAPABILITY_NAMES`: one per
  IR node and attribute kind (`element`, `text`, `interpolation`, `conditional`, `list`,
  `static-attribute`, `bound-attribute`, `class-binding`, `style-binding`, `attribute-spread`),
  plus `props`, a root `fragment`, `svg`, `listbox`, `interactivity` (listeners, template refs,
  watchers, `watchEffect` and lifecycle hooks), a listener's options (`event-capture`,
  `event-once`, `event-passive`), DOM semantics (`event-semantics`), an event control that runs
  on more than the event (`conditional-event-control`), `use-id`, `next-tick`, a prop the
  parent passes only after the component mounted, which a derived value or a watcher reads
  (`late-prop`), and composition's (ADR-0055): components and their events, the slot forms,
  models and `v-model`, fallthrough, a contextual root, `expose`, context and dynamic
  components. `compositionUse` finds where a component first uses composition: until a target's
  M3 lane lands, its `emit` reports UF1002 there and emits nothing for it.
  Each cell is `native`, `emulated` with the name of the inline helper the target prints (React's
  `cx` for `class-binding`), or `unsupported` with a portability diagnostic: a target declares in
  its matrix what it cannot render exactly (P4, ADR-0033). `requiredCapabilities` derives what a
  module uses from its IR, with where each capability is first used (each component's props, then
  its setup items through the exhaustive `SETUP_ITEM_CAPABILITIES`, then its render tree): the
  compiler's capability check and the render-parity tests read it. `BEHAVIOURAL_CAPABILITIES`
  change what code does in the browser, not what renders, so the render-parity tests compare a
  case that uses one its target leaves unsupported as any other (ADR-0033, as amended by
  ADR-0047); `CAPABILITY_PREREQUISITES` names what each refines (`interactivity`), which the
  compiler reports alone where the target lacks it.
- **Event controls** (`handlerControls`, `ownControls`, `eventCalls`, `handedControls`, ADR-0047):
  the `preventDefault()` and `stopPropagation()` calls a target that runs them apart from the
  handler (Qwik) can run as the event is dispatched, read from the body by the IR's event
  parameter: those at the top of a template listener, its leading statements, each a control, an
  `if` without `else` whose test reads only the event around one control or one call, a guard
  clause whose test reads only the event (`if (event.key !== "Enter") return;`, one of the tests
  of what follows, `negated`), or a call of a local function that makes a control (read through
  `void`, `await`, type assertions, and `&&`, `||` and `?:` on a test of the event, whose tests it
  runs under), whose own top is lifted the same way. A test that reads what a control changes
  (`event.defaultPrevented`, `cancelBubble`, `returnValue`) is no test of the event, and no
  control after code that reads one is lifted. Every other control, and every other call of a
  function that makes one, is `unliftable`, and `requiredCapabilities` derives
  `conditional-event-control` at it, at a `once` listener whose control runs under a condition or
  on an element listening to the event in both phases, at a capture listener with a control where
  an element of the component listens to the event in both phases, and where client code hands a
  local function that makes a control and captures something of the component to anything but a
  call that never runs it (`removeEventListener`, `clearTimeout`), calls one outside a template
  listener's top, or makes a control in a callback after a call of such a function
  (`handedControls`).
- **Expressions and setup code** (`rewriteExpression`, `rewriteCode`, plan §5.4, ADR-0045): IR
  code keeps its source text, and a target prints it by splicing its own spelling of each
  reference (`RewriteRules`: Solid's `props.label`, and Angular's `this.label()` in a list's
  `track`, which reads no template variable; elsewhere Angular reads the `@let label =
this.label();` it declares, as written) at the reference's span, expanding a shorthand property
  whose spelling changes. Each rule gets the site the code is printed for (`render`, `key`, `pure`
  or `client`) and the reference, a local function's call flag included. Setup code adds
  structural references: a `write` or an `emit` hook replaces a whole write or call of `emit`
  once the references in its value or arguments are rewritten, nested ones first (`timer =
setInterval(() => count.value++, 1000)`), and its replacement is parenthesised where it could
  not stand as a statement or an arrow's body; without the hook the write keeps its form with its
  target spelled as a read (`count += step`). `writtenValue` gives the value a write stores, with
  the operands parenthesised as its operator needs (`count * (a + b)`), for a setter. `api` and
  `event` rules spell `nextTick` and an event parameter's members. Everything else stays as the
  author wrote it: literals, spacing and comments. Code is never re-printed from an AST, since
  oxc-codegen writes `1000` as `1e3` and drops comments. `parseExpression` and
  `parseStatementsSource` (through `@unframework/parser`) only check that code is one expression
  or a list of statements and give its AST with offsets relative to the code; `codeKind` says
  which a component's piece of setup code is (a function's block body is statements);
  `needsParentheses` says whether code needs parentheses in a slot (an operand, a conditional's
  test, an argument). `referencedBindings` gives the bindings the printed code reads, handlers and
  setup code included unless `includeClient` is `false`, so targets leave out an unused
  destructured prop or list index (L5) and keep one only a handler reads; `liveBindings` and
  `liveTypes` give what a target that prints no client code (Astro) still needs, following the
  template's reads through the setup's declarations and the type declarations they name.
- **Functions** (`functionText`, ADR-0045): a function the source writes, printed from its parts
  with its body rewritten for a site: an arrow, or with a name a `function` declaration (whose
  expression body is returned), an object literal or a sequence body in parentheses.
  `parameterText` prints a parameter as written (rest, optional, pattern, type, default),
  `functionBodyText` a body as statements for a function a target builds (a method), and
  `handlerText` a listener's handler: a named one as the rules spell its function, an inline one
  as an arrow.
- **State kinds** (`isPrimitiveState`, ADR-0046): whether a state is known to hold a primitive,
  from its type argument (keywords, literal types, unions of them, a local alias of them) or its
  initial value (literals, templates, operators, a read of a primitive prop, constant or state, a
  `computed` by its type argument or its getter's value, a `.length`, a call of a setup function
  with a primitive return type, of a pure global that returns one (`Number`, `String`, `Math.*`,
  `parseInt`, …) or of a method that does (`trim`, `toFixed`, `join`, `includes`; `slice`, `at`
  and `concat` on a primitive receiver only)).
  A target whose state proxies an object deeply declares any other state shallow (Svelte's
  `$state.raw`, Vue's `shallowRef`): state is replaced whole (ADR-0008), and a shallow value is
  the source's own object.
- **JS and JSX:** ESTree builders (`js.*`: object and array patterns, type annotations and type
  arguments, class fields and methods with modifiers, a constructor and `implements`, async
  functions and arrows, members and optional chains, `this`, `new`, `await`, assignments and
  updates, `if`, operators, JSX elements, fragments and spreads) printed with oxc-codegen
  (`printModule`, `printProgram`, `printExpression`). Code copied from the source enters an AST
  only through `Placeholders` (an expression, a type, a parameter or a list of statements, the
  last ending in a semicolon it may lack), spliced as written once the module is printed, or as
  text joined between printed pieces: `printComponentModule` prints a JSX target's file as its imports, the copied type
  declarations, the component and its inline helpers. `jsxNode(node, jsxContext(…))` writes any
  render node as JSX. Its defaults are React's (ternary chains ending in `null`, never `&&`;
  `.map` with the `key` first and the index only when read; `<>…</>` for several nodes; `{expr}`
  and `name={expr}`; class parts as an array; style objects with camelCase keys; a spread as
  one attribute per declared key, its `class` merged into the element's; a listener as
  `onClick={handler}` with `Capture` for the capture phase (`jsxHandler` prints the handler for the
  `client` site), and a template ref as `ref={input}`), and a `JsxDialect` overrides attribute
  names, expressions, conditionals, lists and each attribute kind, listeners (whose names and
  options are each framework's own) and template refs included. Text
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
- **Markup** (`src/markup/`, plan §5.8, ADR-0026): `printMarkup(render, dialect, { component,
rewrite })` prints a component's root element or fragment, every node and attribute kind, with a
  dialect per template language (`vueDialect`, `svelteDialect`, `angularDialect`, `astroDialect`,
  and `htmlDialect` for static HTML). The generic printer (`markup/printer.ts`) walks the IR, spells
  each expression with the target's `RewriteRules` (a list's key for the `key` site, a handler for
  the `client` site), reads a spread key by key (its `class` merged into the element's), and lays
  out lines; each dialect (`markup/<language>.ts`) decides how its language writes text,
  interpolations, bound attributes, class, style, conditionals, lists, listeners and template refs
  (Vue's `@click.capture="…"` and `ref="…"`, Svelte's `onclickcapture={…}` and `bind:this`,
  Angular's `(click)="…"` running the statement its target supplies through `MarkupOptions.handler`
  and `#name`, nothing in Astro, which is `inert`; a listener option a language cannot write throws,
  for its target to write), and escapes code, a listener's statements included, for what its
  template scanner reads inside it (Vue's `}}` and character references; Angular's lexers, whose
  literals it re-prints, whose comments it drops, and for which it escapes a regular expression's
  quotes, `;`, lone parentheses and `//`; Svelte and Astro read balanced JavaScript). A dialect may
  also rename an element whose content its language reads by name (`elementName`: Angular's
  `<svg:title>`). Vue's attributes follow `vue/attributes-order` (`ref` with `key`, listeners last).
  Vue's and Angular's compilers parse a static `style` again: Vue's dialect binds a declaration its
  parser would misread (a `;` in a string), and Angular's refuses one, which the analyser rejects
  (UF3022). Text is written so its compiler builds exactly the IR's DOM: delimiters escaped,
  whitespace the compiler would collapse or drop written as something it keeps (with `TextPosition`
  saying where the text sits: its element, its container, its neighbours), text at the root's edges
  protected from the whitespace a target puts around the markup. Line breaks only go where the
  whitespace they create cannot reach the DOM: between elements and blocks and at content edges
  where the compiler drops it, inside a tag or after a block's closing where it does not (Svelte);
  text and interpolations hug their neighbours, and a `<title>`'s content stays on its tag's line,
  since Astro keeps its whitespace. An attribute whose code spans lines puts its tag's attributes
  one per line, and its continuation lines move to the attribute's column (a handler's body one
  level in, its closing brace at the attribute), never a line inside a string or template literal.
  Childless SVG elements close themselves. The entry exports what targets build on beside the
  dialects: `operand`, `test`, `negate`, `conjoin`, `member`, `angularCode`, `vueAttributeCode`,
  `codeTokens` and `mapCode`. The targets' `markup-semantics` tests render the shared cases of
  `test/markup-cases.ts` through each framework and its L5 linters.
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
  bindings, every variable its expressions and setup code read or declare (`codeNames`), its
  functions' parameters, and the types its setup's annotations name (`typeNames`)) and claims its
  own (`props`, `cx`, `Show`, `setCount`) from the same scope, so nothing it adds captures or
  shadows the author's code (ADR-0035). `kebabCase`, `pascalCase`.
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
  `lintWithEslint` runs ESLint's API with its `eslint.config.js` (the template languages, and
  Qwik's type-aware rules: with `tsconfig`, the files are typed through a temporary tsconfig
  that extends it and lists them, as `runChecker` does), and `mergeLintResults` joins the two.
  Both reject a linter that cannot start or load its
  configuration or plugins, skips a file, or prints output they cannot read, and return every
  message by file in a stable order.
