# @unframework/analyzer

Passes P2 (analyse) and P3 (lower) of the Unframework compiler (plan §5.1):

- `analyze(parsed)` checks a parsed `.uf.tsx` module and lowers each component's returned JSX into
  the portable IR. It reports every construct it cannot lower as a diagnostic, and never copies
  code through unanalysed (P2). It never throws. A syntax error stops it. Any other module-level
  error (an import, a top-level declaration) drops every component, which are still checked, so
  that fixing it reveals nothing new; an error in a component drops that component only.
- JSX text means what every JSX implementation agrees it means. Babel (Vue's and Solid's JSX)
  decodes character references and then trims lines; TypeScript, oxc (the React target's JSX)
  and esbuild trim the raw lines first, also trimming Unicode whitespace, and split them at U+2028
  and U+2029. `readJsxText` and `readJsxAttribute` read text and attribute strings by Babel's
  rules and find every place the others disagree, which the analyser reports (UF3009) instead
  of choosing one, with a fix that keeps Babel's reading wherever applying every fix of the text
  reveals nothing new; `decodeJsx` decodes references. The tests check this against Babel, oxc
  and esbuild themselves. JSX decodes only XHTML's named references: a name only HTML decodes
  (`&check;`) renders as written on every target, which is a warning (UF3011).
- Markup is HTML, or SVG inside an `<svg>` (ADR-0040), checked against the vocabulary in
  `@unframework/ir`'s `html.ts` and `svg.ts`: element names (UF3001, UF3002, tested against Vue's
  and Angular's lists, and SVG's against parse5's case adjustments), the nesting the browser's
  parser repairs (UF3003, tested against parse5, Svelte and Vue, and seen through conditionals,
  lists and fragments), attribute names and values (UF3004 to UF3008, ARIA's value types and roles
  included), and characters HTML would not keep (UF3010). Whatever the targets would render
  differently is a diagnostic; a non-canonical form has a fix. The IR it lowers keeps
  `checkInvariants` of `@unframework/ir`, which its tests check on every module.

## The subset

Components with typed props, a setup, listeners and JSX (plan §9 M1 and M2, ADR-0034 to ADR-0040,
ADR-0045 onwards), and the composition of M3's core lane (ADR-0053 to ADR-0055): components that
render each other, slots, fallthrough and `defineExpose`. A module exports at least one component;
one it does not export is lowered too, and each output writes it as a sibling file. A component
is a function declaration; one written as a value (`export const Card = (props) => …`) is UF1102,
checked as the declaration its likely fix writes (`analyze.ts`).

- **Props** (`props.ts`, `declarations.ts`): the one parameter, destructured with static defaults
  or kept as one object read as `props.x`, typed by an object type literal or a local `interface`
  or `type`. Member types keep to what every target's props can declare. Problems are UF2001 to
  UF2003, and UF1002 for types that land in M5. Each top-level type declaration must be reached by
  some component's props; the outputs copy it as written.
- **The authoring API** (`authoring.ts`): named imports from `"unframework"`, recognised by the
  binding each declares (ADR-0006), as the package exports them (a test reads its `index.ts`).
  Anything else is UF2016; `defineModel`, `provide` and `inject` are UF1002 until M3's models and
  context land.
- **Composition** (`api.ts`, `components.ts`, ADR-0053 to ADR-0055):
  - A component's API (`ComponentApi`: its props, events, slots, exposed functions, options and
    the shape of its root) is read from its declarations alone, before any component is lowered:
    the module's components render each other and themselves, and `analyze` returns the module's
    API for the compiler's resolver, whatever its templates hold.
  - `analyze(parsed, { imports })` takes the API of each `.uf.tsx` module the source imports,
    by specifier (`componentImports(parsed)` lists them): an import the resolver gave nothing
    for, or a name the module does not export, is UF1202, and the module records each one it
    lowers (`ModuleImport`).
  - A PascalCase tag names an imported component, one of the module's own, or the component
    itself (UF3047 otherwise, with a likely fix to a close name). Its attributes are props, the
    listeners of the events it declares (`onClear`, a local function or an arrow whose parameters
    are the payload; an option suffix is UF3043, with a safe fix), `class` and `style`, which fall
    through to its root (UF3045 where it renders neither: `inheritAttrs: false`, or a root that is
    not one element or one component), `key` in a list, and a `ref` that holds what it exposes
    (UF3046 where it exposes nothing). Its children fill its default slot, or one slot object
    fills its slots with arrow functions that return JSX (UF3040), a scoped fill's parameter
    binding `slotScope` names; `slots.title` in a slot object, or `{slots.default?.()}` as the
    children, forwards the parent's own slot. What the child does not declare is UF3035, UF3036
    or UF3038 (layer 2 of §5.6). Its root element is checked where it sits, as the element would
    be (UF3003).
  - `defineSlots` (UF2029: an optional method each, named apart from the props and the events'
    callbacks), `defineExpose` (UF2030: the setup's local functions, in shorthand) and
    `defineOptions` (UF2031: `{ inheritAttrs: false }` alone). A component renders a slot with
    `{slots.title?.()}`, its props an object literal and its fallback after `??`, and tests one
    with `slots.title` in a template (`SlotReference`); any other use is UF3041.
- **The setup** (`setup.ts`): each statement before the return, in source order, as a setup item
  and a binding (ADR-0045): `ref`, `computed`, `useTemplateRef`, `useId`, `const`, `let`, local
  functions, `watch` (a ref, a getter or an array of them; `immediate` and `flush`),
  `watchEffect`, `onMounted`, `onUnmounted`, and the events of `defineEmits` (UF2009). A first
  pass declares every binding, so client code reads what is declared after it; a second walks
  each item's code in source order. A macro elsewhere is UF2005, one whose result is not bound
  UF2006, an early return UF2012, a reserved name UF2003, and a statement the setup would only run
  UF1002. The types the setup's code writes are roots of `collectTypes`, copied as written. An
  event's name is camelCase apart from the props' names, and no Angular expression keyword,
  allowed global or `constructor` (UF2008, renamed by a safe fix), its payload a props
  type (UF2009); a watcher watches a ref, a getter or an array of them
  (UF2020, with fixes for a prop and a ref's value); state and a setup `let` have a type the
  outputs can declare, and an annotated `let` without a value one that admits `undefined`
  (UF2021); a callback passed by name is UF2022 (wrapped by a safe fix); a
  watcher's default options are UF1002 (removed by a safe fix), `immediate` with `flush: "post"`
  UF2013; `onCleanup` is only called, at once (UF2013 for an immediate watcher, else UF1002).
- **Expressions and code** (`expressions.ts`, `code.ts`): one walk in three modes (ADR-0045),
  which resolves every name with `@typescript-eslint/scope-manager` (`scope.ts`, which tells the
  setup's names, function-local names and the module's apart) and records it as a reference. A
  template expression keeps to the subset every target reads alike, Angular's template language
  included: names are props, the setup's bindings (a ref's value as one reference spanning
  `x.value`, UF3026 for the ref alone), list variables, expression-local arrow parameters and the
  allowed globals; anything else is UF3020, UF3019 (time, chance, locale) or UF1002. Impure
  expressions are UF3021, `??` and `?.` on a value that is never nullish UF3023, a parameter that
  shadows a rewritten name, takes an Angular keyword or is never read UF3024 (a part the walk
  reports without reading counts as reading every parameter it names). A getter and an initial
  value are pure code, script or class code on every target; client code (handlers, callbacks,
  hooks, local functions) reads every global lib.dom declares (a `window` member whose bare name
  reads like the component's own is UF3020, read through `window` by a likely fix), and has
  statements (those the React Compiler cannot compile included: React's output opts out of it,
  ADR-0046), writes of state as statements of their own (`Write`; a type assertion on the
  written target is UF1002, with a likely fix that removes it;
  UF2011: an arrow passed to a call writes in a block body, but for an `onCleanup` callback,
  with a fix), emits of declared events (`Emit`, UF2017), `await nextTick()` (`Api`; a callback
  is UF2025, judged with the rules, and so are `nextTick` used as a value and a call of it through
  parentheses, an assertion or type arguments, written bare by a safe fix), the event parameter's
  members (`Event`) and the leading `preventDefault()` and `stopPropagation()` calls, which Vue's
  modifiers and Qwik's markers read (after guard clauses that test only the event, which codegen's
  `handlerControls` reads, and no other statement that may leave the body); any other control runs
  in place, but one after an `await` or in a function inside the handler, which runs once the
  event is over (UF3033). The walk also judges what needs the syntax (ADR-0045): a change in place
  of a value code did not build itself, or of what a shallow copy holds, a destructuring's and a
  loop's member targets included (UF2004, with fixes that replace a ref's value whole;
  `origins.ts` tracks where each value comes from, a name's through every value the component's
  code writes to it, and what a value code built holds through what the code writes into it), a
  setup `let` or a template ref read where values are tracked (UF2010; in `watchEffect`, with the
  rules), a local function used as a value (UF2022), a rendered element (a template ref's, the
  event's, a node reached from one, or an item of one's collection) whose structure or text code
  changes by hand, or whose classes or style it changes where the template binds them (UF3028), a
  ref's value, a prop outside the template, or a member of either, used where only a condition's
  narrowing (or an assignment's before it) makes it one kind of a union, read into a local,
  returned or assigned whole after it (UF3031, with a fix that reads it into a local before the
  first statement that narrows it), an event member React's synthetic event lacks or the event
  used whole (UF3032), a local that shadows a rewritten name (UF3024), the clock, chance and the
  locale in a getter or an initial value (UF3019) and a global only client code reads there
  (UF3020). A small syntactic model of value kinds (`types/`) feeds the checks that depend on
  what a value can be, narrowed where a reference is read by the tests around it (truthiness,
  `typeof`, `Array.isArray`, a literal, a discriminant) as TypeScript narrows its type, where
  every target keeps the narrowing (`narrowing.ts`, which also reads the tests of the `if`
  statements around code and before it, and the nearest write before a read in its function). A
  read that relies on a condition or a write showing it, or a member path off it, present is
  marked in the IR (`BindingReference.narrowed`, ADR-0046), with where that condition is (the
  read's own function or expression, a closure around it for a destructured prop, or the template
  around a handler, which also marks a handler's read it narrows by kind), for the targets that
  read it through a call or a mirror, and so is a compound write's target its operator reads
  (`if (count.value !== null) count.value += 1`, `WriteReference.narrowed`); the setup's kinds
  follow TypeScript's inference (a `ref` widens a fresh literal, a `computed` keeps a union).
- **The rules over summaries** (`rules.ts`): judged once the setup and the render tree are
  lowered, with every local function's summary (`summarize` of `@unframework/ir`, which the
  invariants and the targets read too) and what the walks noted (`CodeFacts`): the calls a
  template, a getter or an initial value makes of an impure function (UF2014) or one that reads
  the clock, chance or the locale (UF3019); a `watchEffect` reading a setup `let` or a template
  ref while it runs, itself or through a function (UF2010); an immediate watcher's callback that
  is not safe on the server (UF2013); a watcher that reads the DOM before it updates (UF2018, with
  the likely fix that adds `{ flush: "post" }`; the globals that see what a render changes are
  `readsDom`'s, and what follows an `await nextTick()` every path to it passes reads the updated
  DOM); a read before declaration in code the setup runs (UF2023; a call of a
  `function` declaration, which is hoisted, is judged by what it reads and reaches); a call of a
  function that touches state inside a callback that runs at once, and recursion (UF2024); a
  `watchEffect`'s, or an object-valued getter's, reactive read under a condition (UF2015); a
  setup `const` that reads a prop, a ref or a `computed` (UF2007, a warning, with the likely fix
  that makes it a `computed`); and an authoring type in a copied annotation (UF2019, with a fix
  that removes an inferred one). `client-rules.ts` judges client code the targets run in
  different orders: `nextTick` given a callback (UF2025, with a safe fix that awaits it where
  the function can become `async`), a template ref read by what teardown runs (a call, or a
  function passed to a call that runs it; `removeEventListener` runs nothing) or an `async`
  `onUnmounted` (UF2026), a `watchEffect` that writes a state it reads while it runs (UF2027;
  `suspension.ts` finds what runs after an `await` or in a function handed to a timer, `then`,
  `addEventListener` or `onCleanup`, written in place or held in a local `const`, and marks the
  references there `later` in the IR, which UF2015, UF2010 and every target's dependency list
  leave out, ADR-0048), and `preventDefault()` in what a passive listener runs
  (UF3034, with a safe fix that removes it). `type-queries.ts` reports
  a type query of a prop, a setup binding, a list variable or the authoring API, which the outputs
  respell or erase (UF1002); a function's or a handler's parameter is an ASCII identifier
  (UF2003).
- **Children** (`lower.ts`, `lists.ts`): text, expressions rendered as text (UF3016), conditionals
  (`c && X`, `?:` chains holding JSX; UF3025 for `||` and `??` with JSX, fixed as `x ? x : …` and
  `x != null ? x : …` where `x` is a reference that renders as text) and keyed lists
  (`source.map((item, index) => <el key={…}>`; UF3013 to UF3015, UF3018 for the source and the
  key; `source?.map(…)` is a list whose `?.` is UF3023, or UF3018 with the fix
  `(source ?? []).map(…)`). Texts side by side are one text, whatever drops or flattens between
  them. A line feed that can start a `<pre>`, through conditionals and past what can render
  nothing, is UF3017; text in an `<iframe>`, which the parser reads as raw text, is UF3003.
- **Listeners and template refs** (`listeners.ts`): Vue's names lowered to the DOM's event and
  one option (UF3004 for another spelling, with the rename; UF3006 for an event no element
  receives alike), handlers that name a local function or are written in place (UF3029; one in a
  list, or one that reads a value a condition around it narrows, is one call Angular's template
  statements read, and writing that value is no read), and `ref={input}` on one element outside
  lists (UF3027). An element's
  listeners are judged by Svelte 5.57.1's five handler-dependent accessibility rules (`a11y.ts`,
  UF3030), on the source's listeners, its tables Svelte's own.
- **Attributes** (`attribute-names.ts`, `attributes.ts`, `enumerated.ts`, `class.ts`, `style.ts`,
  `aria.ts`): name checks first, whatever the value; then static values, literals in braces
  (written statically, UF3004), bindings whose kinds must fit the attribute and whose values
  every typed target's element types accept (UF3018: an enumerated attribute's tokens, a
  string where a target types one), `class` parts, `style` declarations (parsed by
  `@unframework/parser`, UF3022 for what the targets cannot keep apart) and spreads of objects
  whose keys a local type declares. A spread records whether its object may be nullish where
  it renders (`spread-source.ts`): its kinds say whether its type may be, and the conditions
  around it narrow it as every target's checker does; a test the compiler does not follow is
  UF1002, and a source the conditions show is absent UF3004. A bound `value` that may be nullish
  on the elements whose `value` some targets set as a property (`NULLISH_VALUE_ELEMENTS`) is
  UF1002.

Every fix leaves exactly the diagnostics that had none once all are applied (the harness's L1),
which the tests check for each fix, for each pair that can meet, and over random mixes.

## Tests

`pnpm --filter @unframework/analyzer test`. Besides the rules' own tests, the conformance tests run
the tools the rules stand for: parse5 (the HTML parser's repairs and SVG adjustments), Svelte, Vue
and Angular (element and attribute tables, ARIA warnings, Angular's security schema), Babel, oxc
and esbuild (JSX text), and Angular's template parser over a seeded fuzz of every accepted
expression form. `types-conformance.test.ts` runs `tsc` (the executable, never the API) over
probes of every attribute of every element against Vue's, React's, Solid's, Qwik's, Svelte's and
Astro's element types, resolved from the target packages, under the names each target prints:
what the analyser accepts in a binding, every target's types accept, and every name it accepts,
the authoring types, React's and Vue's declare. `kinds-conformance.test.ts` pins the setup's
kinds against TypeScript's inference, `events-conformance.test.ts` the IR's event vocabulary
against the authoring types, lib.dom and React's synthetic events, and `a11y-conformance.test.ts`
UF3030's tables against Svelte's and its verdict on every HTML element, with each handler, role
and `tabindex` its rules read, against Svelte's compiler. The IR holds the tables both read
(`UNDECLARED_ATTRIBUTES`, `UNBINDABLE_ATTRIBUTES`, `RESERVED_TYPE_NAMES`, `CSS_PROPERTIES`), so
`checkInvariants` rejects the same.
