# @unframework/ir

The Unframework intermediate representation: what the analyser knows about a `.uf.tsx` module, as
plain, versioned, schema-validated JSON (plan §5.3).

- **Types:** `UfModule` (its components, exports and the local type declarations their props,
  events and setup use), `UfComponent` (props, the props parameter, the events `defineEmits`
  declares, bindings, the setup and a render root that is an element or a root `Fragment`), the
  render nodes (`Element`, `Text`, `Interpolation`, `If`, `For`) and the attribute kinds
  (`Static`, `Bound`, `Class`, `Style`, `Spread`, and the listeners and template refs, `Event` and
  `Ref`). A binding is a prop, a loop variable, a `ref` (`state`), a `computed` (`derived`), a
  template ref, a setup `const`, function or `let`, or `emit`, by its `name@offset` id. The setup
  is a list of items in source order (`State`, `Derived`, `TemplateRef`, `Id`, `Const`,
  `Variable`, `Function`, `Watch`, `WatchEffect`, `Lifecycle`, ADR-0045). An `Expression` is a
  template's source text at its span, with every identifier resolved to a binding or an allowed
  global; setup `Code` also resolves writes, emits, `nextTick` and a handler's event members, and
  a `FunctionCode` keeps a function's parameters, flags and body apart, for the targets that print
  it from its parts. A ref's value is read as `count.value`, which its reference spans.
- **Composition (ADR-0055):** a module's `imports` of other `.uf.tsx` modules, each with the
  `ModuleApi` the compiler's resolver returned (ADR-0053), and its injection `keys`; a
  component's `slots`, `exposes` and `inheritAttrs`; the render nodes `Component`, `SlotOutlet`
  and `Dynamic` (`<component is>`), a list's body that is a component, a component's attributes
  (`Prop`, `Listener`, `ModelBinding`, `Class`, `Style`, `Ref`) and fills, an element's `v-model`
  (`Model`), the setup items `Model`, `Provide` and `Inject`, the binding kinds `model`, `slots`,
  `slotScope`, `context` and `component`, and a slot's presence (`Slot` references). The analyser
  lowers none of it yet: M3's lanes do.
- **Builders:** one per type (`createModule`, `createComponent`, `createElement`, `createFor`,
  `createExpression`, `createCode`, `createWriteReference`, `createFunctionCode`,
  `createStateItem`, `createEventAttribute`, …). They write keys in the order of the types, which
  is the order of every `ir.json` snapshot, and leave an absent optional field out.
- **Visitors:** `walk` (every container, the root fragment included), `childrenOf`,
  `collectFeatures` (node, attribute, binding, setup item, handler, watch source and code
  reference kinds, which the coverage gate reads), `expressionsOf` (every template expression of
  a component with its JSON Pointer), `codeOf` and `functionsOf` (the setup's and the handlers'
  code and functions, each with the context it runs in: `pure` for what the setup evaluates,
  `client` for what runs in the browser), and `spansOf` (every span of a module). `summarize`
  says what each local function does, itself and through the functions it calls (writes, emits,
  reads, calls, `nextTick`, `await`, template refs, setup `let`s, client-only globals, whether it
  escapes as a value): the analyser, the invariants and every target judge a call by it, and the
  IR holds no summary a plugin could falsify. `summarizeTracked` leaves out the references marked
  `later` (in a function client code hands to a timer, `then`, `addEventListener` or
  `onCleanup`, ADR-0048): what a `watchEffect` tracks, which every target lists as its
  dependencies.
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
  defaults, and a local `Props` only as the props type of every component its props reach;
  bindings in scope, and code that fills its span (a prop in the object form as the parameter's
  member, a ref's value as `name.value`); a read's narrowed paths (`narrowed`, ADR-0046), each
  the read or a member path off it, narrowed by the template only in a handler's code and across
  a closure only as a destructured prop's own read, and a write's narrowed target only where its
  operator reads it (`+=`, `++`); the shapes of conditionals, lists and fragments; and
  loop variables no target's rewrite captures, keyed by their own list's item or index. For the
  setup (ADR-0045 to ADR-0049): items in source order, each declaring one binding of its kind,
  named apart from the component's other names and from what the targets reserve; code that runs
  where it may (templates and what the setup evaluates write, emit and await nothing, read no
  template ref or setup `let`, call only pure local functions, a getter only those that read
  static values, and read only what is declared before them); writes of a `state` or a `let`,
  emits of a declared event with as many arguments as it takes, in client code only; an immediate
  watcher safe on the server, and DOM reads only after the DOM updates; functions with the
  parameters their role takes; listeners of an event of the vocabulary, with one option at most,
  whose handlers use only the event members every target's event carries and list their leading
  `preventDefault()` and `stopPropagation()` calls; and each template ref attached by one element
  outside any list and Angular's literal region. For composition (ADR-0055): a component element
  names exactly one imported or local component, and each prop, listener, model and fill a
  declaration of its API; a slot outlet, a slot's presence and a forwarded fill name a declared
  slot; a model's binding is a `state`'s or a `model`'s `.value`; an injected value is never
  written; a `Dynamic` node's candidates are all tags, whose attributes and children each tag
  keeps as an element, or all components; slots, exposed functions and models are declared once,
  a model named apart from the props; `provide` and `inject` name a key the module declares or
  imports; and a `v-model`'s control is one of its element. The compiler emits from no module
  that breaks one, a plugin's included, and checks itself that a plugin's code is the analyser's.
- **Portability facts:** what the targets render differently from the same markup
  (`portability.ts`): elements Vue does not know, template syntax, attributes a framework acts on
  or sets as state, `contenteditable` with children, empty URLs React drops, whitespace Svelte
  drops, attributes Angular cannot bind, text the parser moves or drops, and the root elements
  tied to their parent that Angular's host breaks (`CONTEXTUAL_ROOT_ELEMENTS`). The analyser reports each
  at its source, and the invariants reject them in any IR; but for a bound `value` that may be
  nullish where some targets set the property (`NULLISH_VALUE_ELEMENTS`), which the analyser
  alone can tell: the IR holds no kinds.
- **Vocabulary:** the HTML elements, attributes and content-model facts the analyser validates
  against, and the printers and targets lay out by (`html.ts`), with the boolean attributes a value
  can be bound to and the attributes React and Qwik type as numbers; the SVG elements and
  attributes, case-exact (`svg.ts`); CSS facts: unitless properties, shorthands as Chromium
  expands them, and what a static value may hold (`css.ts`); the DOM events a listener may take
  with their interfaces, the window's and the unsupported ones apart, the events a listener may
  be passive on, and the event members every target's event object carries for each
  (`events.ts`: `DOM_EVENTS`, `PORTABLE_EVENT_MEMBERS`, `PORTABLE_EVENT_INTERFACES`); the globals
  each context may read (`ALLOWED_GLOBALS` in templates, `PURE_GLOBALS` in what the setup
  evaluates, `CLIENT_GLOBALS` in client code: every name lib.dom declares, `LIB_DOM_GLOBALS` in
  `browser.ts`, but the `window` members read only through `window`, `WINDOW_MEMBER_GLOBALS`;
  with the `BROWSER_GLOBALS` and `SCHEDULING_GLOBALS` a server-safe watcher may not, and
  `readsDom`, the reads that see what a render changes) and the reserved prop, parameter and
  setup binding names (`names.ts`). Its tables are maps, read with names from the source.
  `ID_REFERENCE_ATTRIBUTES` and `idReferencesIn` are how the analyser and the tests' normaliser
  both find id references (the generated-id prefix, ADR-0031). `listBoxSize` reads a `<select>` as
  HTML does: a single-selection list box with an option a drop-down would select starts with none
  selected (the `listbox` capability), and what is known only at run time counts as one.

The IR has no dependencies and imports nothing from TypeScript: it is pure data. The tables say
where each comes from; the analyser's conformance tests check them against the frameworks and
parse5.
