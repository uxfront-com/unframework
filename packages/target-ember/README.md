# @unframework.dev/target-ember

The Ember 7.4 target of the Unframework compiler: one `.gts` file per component, in Glimmer's
strict mode, and one `.ts` module per directive and composable. The target is opt-in
(`targets: ["ember"]`). It emits every capability: the cells it builds with an inline helper are
emulated, and `late-prop` is unsupported by design, as a warning.

## The module

In order: the imports from `@glimmer/component`, `@glimmer/tracking` and `@ember/*`, the
pass-through imports (ADR-0064) and the values it reads of its `.ts` modules (ADR-0070); the type
declarations the component reaches, copied as written (ADR-0067, ADR-0068); the module's constants
it reads; the signature; the component; the inline helpers it calls.

- **The signature.** `export interface CardSignature { Args: CardProps & CardEvents; Element: … }`.
  `Args` is the props annotation as written, and the events' interface, `CardEvents`, whose
  members are optional arguments, `onChange` for `change`, that take the event's payload. `Element` is the root element's interface, or a root child's `Element`,
  which takes the caller's attributes with `...attributes`. A component whose root takes
  fallthrough also takes `style?: unknown`, the caller's `style`.
- **Template-only.** A component with no member of its own is a `TOC<CardSignature>` constant whose
  template reads its props as `{{@title}}`.
- **A class.** Any other component is a `@glimmer/component` class. A prop with a default is a
  getter, which an absent or `undefined` argument sends to the default. The setup's functions are
  arrow fields, first, as the source's declarations are hoisted. Then, in source order, a `ref`
  and a template ref are `@tracked` fields, a `computed` a getter and a `const` a `readonly` field.
- **Listeners and emits.** `{{on "click" this.save}}`, with `capture=true`, `once=true` and
  `passive=true` as named arguments. An inline handler is an arrow field (`this.listener1`), or one
  that takes the row variables it reads (`(this.listener1 item)`). It tests again the conditions of
  the branches around it that narrow what it reads. `emit("change", value)` calls
  `this.args.onChange?.(value)`.
- **Template refs.** An inline modifier, `{{templateRef this "input"}}`, sets the member to its
  element once it is rendered, and to `null` once it is gone.
- **Watchers and hooks.** Glimmer has no effects, so the template calls them. It calls each
  watcher's `flush` before anything else: the callback runs right after the render that sees a
  change of a source, or once that render settles for `flush: "post"`. A state with a
  `watchEffect` beside it is `@tracked({ equals: Object.is })`, so a write of the value it holds
  runs nothing, as on Vue. It calls each `watchEffect`'s
  `flush` after everything else, from the first render that settles in the browser. And it calls
  `onMounted` last: the `onMounted` hooks run once the first render settles, and the `onUnmounted`
  hooks are registered as destructors then. On the server (`import.meta.env.SSR`), as on Vue's,
  no hook runs, and a watcher runs only its immediate first run. Cleanups run before the next run and when the component is destroyed.
  Effects are an anti-pattern in Ember, as in every framework: a source that derives the value,
  or does the work in the handler that causes the change, compiles to plainer Ember. These
  helpers exist so that a source with `watch` or `watchEffect` still compiles.
- **Expressions.** A Glimmer template reads paths, literals and helper calls, never JavaScript. So
  a path (`@user.name`, `this.total`, `item.label`) and a literal stay in the template, and any
  other expression becomes a member: a getter (`{{this.value1}}`), or an arrow field the template
  calls with the row variables it reads (`{{this.value2 item}}`), its parameters typed from the
  list's source (`NonNullable<this["args"]["items"]>[number]`). A member reads its expression under
  the conditions of the branches around it that read what it reads, since a getter is no branch
  TypeScript narrows in. A path under a condition that is no path is a member too.
- **Control flow.** `{{#if}}`, `{{else if}}` and `{{else}}`, and `{{#each … key="…" as |item|}}`,
  keyed by the item's path, `@index` or `@identity`.
- **Names.** Glimmer reads a tag named like a name in scope as that component (`<button>` with
  `button` imported), so such a name takes another (`button_1`), as does a name that is a keyword
  of the template (`each_1`).
- **Text.** `{{` is written `\{{`. Inside a `<pre>`, a line feed that starts a text after a
  mustache is `&#10;`, since Glimmer's tokenizer drops it as HTML drops the one after the start tag.

## Capabilities

`bound-attribute` and `attribute-spread` go through `enumeratedValue`, which writes the boolean of
an ARIA or enumerated attribute as its name, as Vue does, where Glimmer writes `true` as an empty
attribute and leaves `false` out. `class-binding` goes through `classNames`, and `style-binding`
through `styleText`, which marks the style safe with `htmlSafe`. `contextual-root` is native: a
Glimmer component has no host element. `interactivity` and the listeners' options and semantics
are native: `{{on}}` calls `addEventListener` on its element. `use-id` is native: `useId()` is
an id counted per application, `uf-id-0`, the same on the server and on the client that hydrates
its render. `next-tick` is native: `nextTick()` is
`renderSettled()` from `@ember/renderer`, which resolves once the pending render has run, as
Vue's resolves once its pending flush has. `keyed-identity` and `listbox` follow from Glimmer.
`late-prop` is unsupported by design, as a warning: an Ember parent names each argument in its
template, so it passes every argument from the start. `scoped-styles` and `sheet-order` are native: the module imports the sheet `compile()` scopes
(`import "./Card.uf.tsx.css"`, ADR-0063), and each element carries its `data-uf-…` attribute.
`two-way-binding`, `model-array` and `model-modifiers` are emulated: a `v-model` is the control's
property and a listener, `toggle` adds or removes a checkbox group's value, and an inline
modifier, `modelText`, follows Vue's `vModelText` for modifiers and number fields.
`component` and `component-event` are native: a child is its output's component, imported under
the source's name, its props are its arguments (`@label="Name"`), and a listener of its `clear`
event is `@onClear`. Slots are blocks: `{{yield to="header"}}`, a named block `<:header>`, a
scoped slot's props object as a block param, and `(has-block "header")`. A styled parent's
`data-uf-…` attribute reaches a child's root through `...attributes` (`child-root-scope`).
`context` is native and `reactive-context` emulated. Ember has no context API yet: RFC 1200
(emberjs/rfcs#1200) proposes `createContext`, with draft implementations in
emberjs/ember.js#21450 and #21789. Until one lands, the output follows ember-primitives'
dom-context technique inline, since an output imports only its framework (P7). A provider's
first node in its root element is a text node, `provider`, that holds each value under its key,
and `inject` walks up the DOM from the consumer's own text node to the nearest one. A provided
state is its ref, a `value` getter (`refOf`).

`directive` is emulated: a directive is a modifier on Ember's own manager (`src/directive.ts`),
whose hooks run in Vue's order through the shared `queueHook`, and never on the server.
`dynamic-component` is emulated: each candidate of a `<component is>` is a branch of an
`{{#if}}`. `fallthrough` is emulated: a caller's `class` reaches the root through
`...attributes`, which joins it with the root's own, and a `style` is the `@style` argument, which
an inline helper, `fallthroughStyle`, merges into the root's declarations as Vue does
(`src/fallthrough.ts`). `expose` is emulated: a component ref is the child's `@ref` argument,
from an inline helper, `componentRef`, which the child calls with what `defineExpose` exposes
once it has rendered, and with `null` once it is gone. `model` is native: a model is the child's
argument, `@value`, and a callback, `@onUpdateValue`, which `<Name>Models` declares. The child
reads the argument where the parent passes one and a tracked field of its own where it does not,
and a write sets the field and calls the callback, as Vue's `useModel` emits `update:value`.
`teleport` is native: `{{#in-element}}` appends the content to the target, which an inline
helper, `teleportTarget`, finds in the browser only, so the server renders none of it.
`transition` is emulated (`src/transition.ts`): a transition renders its elements from a list,
`Transition.entries`, which keeps a leaving element until its leave ends, and an inline modifier,
`transitionClasses`, runs Vue's classes of each phase on the element. `slot-forwarding` is
native: a forwarded slot yields to the component's own block, and the child renders in a branch
for each set of the forwarded slots the component got, as Glimmer passes a named block whether or
not the component got the one it forwards. `generic-components` and `generic-slot-props` are
native: a generic component is a class whose signature takes its type parameters, which Glint
infers from a parent's arguments. `async-setup` is emulated: the setup from its first `await` on
runs as the component is constructed, in an inline helper, `AsyncSetup`, and the template renders
once it has run. `composables` and `composable-effect-order` are native: a composable is a
module of its own whose function, which takes the calling component first, makes a class on an
inline base, `Composable`. A composable that runs code in the browser gives the caller `flush`,
`flushAfter` and `mount`, which the caller calls where the call sits among its own, in source
order. `hydration` is native: the client boots the app the server rendered with in Glimmer's
rehydrate mode (`src/toolchain/hydrate.ts`).

## The toolchain

For tests and tooling (the target's main entry never loads it):

- **`@unframework.dev/target-ember/toolchain`**: a Vite plugin, `unframework:ember`, that runs a
  `.gts` module through content-tag, then Babel with `babel-plugin-ember-template-compilation`
  and the template compiler of the project's `ember-source`, and `decorator-transforms`. It
  resolves `@ember/*` and `@glimmer/tracking` to `ember-source`'s own modules. The checks:
  - L3 compiles each file the same way and reports what throws.
  - L4 runs Glint (`ember-tsc`, TypeScript 6) from `tests/toolchains/ember`.
  - L5 runs ESLint with eslint-plugin-ember over the `.gts` files, which oxlint does not parse,
    and oxlint's baseline over a `.ts` module beside them.
    The plugin compiles the app's `.ts` modules that hold a decorator the same way, as an app's
    build runs its own `.ts` modules through Babel: a composable's `@tracked`.
- **`…/toolchain/client`**: mounts with `renderComponent` (RFC 1099), its arguments a tracked
  object that a rerender updates, with the test's listeners as `onChange` arguments. `renderComponent` reads the argument names once, so a rerender
  that adds a name renders the component again.
- **`…/toolchain/server`**: renders as an app renders on the server: vite-ember-ssr boots an
  application under a happy-dom window, its route template invokes the component, and the
  render serialises the body. It patches vite-ember-ssr 0.7.0 so that a form control's state is
  part of the HTML (evoactivity/vite-ember-ssr#46). `renderForHydration` renders the same way,
  with Glimmer's rehydration markers.
- **`…/toolchain/hydrate`**: boots the app the server rendered with (`app.ts`) in the browser
  with `_renderMode: "rehydrate"`, so Glimmer adopts the server's nodes, then behaves as the
  mount adapter does. Glimmer reports no mismatch: where a node differs, it renders its own.
