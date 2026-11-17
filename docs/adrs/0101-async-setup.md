# ADR-0101: Async setup

- **Status:** Accepted
- **Date:** 2026-11-17
- **Plan:** §4.2, §5.4, §6, §7.2 L1 to L12, §9 M8; P4, P7; ADR-0033, ADR-0045, ADR-0053,
  ADR-0069, ADR-0095, ADR-0106; amends ADR-0095 (the `client agreement` render gives the focus
  back)

## Context

A component often needs data before it can render: a user, a team, a translation. Until now an
`async function` component was UF1002, so the data had to arrive through props. Vue lets
`<script setup>` await at its top level, but only under a `<Suspense>` ancestor, which the source
language doesn't have. React, Solid, Angular and Qwik have no top-level `await` in a component at
all: each has its own way to wait, and none of them runs the code after the `await` as part of
the same function.

Hydration makes it harder. The server waits for the data and renders it. The client runs the setup
again and must keep the server's DOM until its own data arrives, with no mismatch reported.

## Decision

### The language

A component may be `async`, as a declaration or an arrow. Its setup awaits only in one form, the
whole value of a top-level `const` that declares one name, with an optional annotation:

```tsx
export default async function Profile({ id }: { id: string }) {
  const user = await loadUser(id);
  const visits = ref(user.visits);
  return (
    <p>
      {user.name} {visits.value}
    </p>
  );
}
```

- **UF2038** `nested-await`: any other `await` at the top level of the setup, like one inside a
  larger expression, a nested `await`, a destructuring, a `let`, a bare statement, a block, a
  condition or a `for await`. An `await` inside a function the setup declares is client code, as
  before.
- **UF2039** `late-await`: an `await` after another setup item (state, a computed value, a
  constant, a `let`, a function, a watcher, a hook, `provide`, `inject`, `useId`, a template ref,
  `defineModel` or a composable's call), and an awaited expression that reads anything but props,
  module values, globals and the values awaited before it, like `emit`, a slot, a model or state.
  `defineEmits`, `defineSlots`, `defineExpose` and `defineOptions` are no setup items, so they may
  sit anywhere.
- An async component with no `await` lowers as a plain one. A generator stays UF1102, and an async
  composable UF2035.
- An async component as a candidate of `<component is>` is UF1002: Vue needs
  `<Suspense :timeout="0">` around the dynamic component, which a later part brings.

The awaits open the setup because React and Solid run them in a function of their own, outside the
component's render, which sees only props and module values, and Qwik runs the body again up to
each await. Loading first, then building state from what loaded, is also the common shape.

The IR gains `AwaitItem`, `{ kind: "Await", binding, type?, value, span }`, whose `value` is the
awaited expression without `await`, and the binding kind `awaited`, a read-only constant. The
invariants require that no `Await` follows another item and that its value reads only what the
rule above allows. `ComponentApi.async` is set when the setup awaits, so a parent in another file
knows: Vue's parent wraps such a child in `<Suspense>`. The capability is `async-setup`, and it
changes the server's markup, so it is not behavioural.

The authoring types declare `JSX.ElementType`, so an async component that resolves to JSX or
`null` is a tag, while one that resolves to a string stays TS2786.

### The semantic guarantee

- **Server.** The render waits for the setup and renders the resolved template, with no fallback
  and no wrapper element.
- **Client-only mount.** The component renders nothing until its setup resolves, then renders.
  "Nothing" allows an anchor comment the framework keeps (Vue, Angular), which normalisation drops.
- **After hydration.** The server's DOM stays as it is while the setup runs again, with no mismatch
  reported, on every target with a live `hydration` cell. The component is interactive once the
  setup resolves: a click before then does nothing.
- **The client re-run.** The setup runs again on the client after hydration, as Vue's does. A
  component must not depend on running once across the boundary, nor on running twice: Qwik's
  resumption runs it once, and so does Solid with its own serialised data.
- **`client agreement`** compares two resolved DOMs: every target's client mount settles only once
  a setup that resolves within a microtask has resolved, so no target declares a difference there.
- **Outside the contract:**
  - A resolved value that differs from the server's. Every hydrating target updates the DOM to
    it, but Vue and React also report a hydration mismatch, as they do for any render that differs
    from the server's. A setup must give the same value on both sides to hydrate cleanly.
  - When a parent's ref to an async child, and its exposed functions, become usable. They are
    usable once the child's setup has resolved, on every target. On Angular an exposed function
    that reads an awaited value throws if a parent calls it before then.
  - A setup whose promise rejects. Each target throws in its own way.
  - A setup slower than the harness's settling: the corpus's loaders resolve after a microtask.
  - Whether a parent's markup waits for an async child on a client mount. Svelte's does.
  - Hosts. A hand-written Vue parent wraps an async component in `<Suspense>`, which Vue requires
    for any async setup. A Svelte host sets `compilerOptions.experimental.async`, per file or for
    the whole app. Svelte's async runtime is on for the whole page once one async component loads,
    and Svelte labels it experimental.

### The lowering

| Target  | Cell                     | Lowering                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vue     | native                   | Top-level `await` in `<script setup>`, which Vue compiles through `withAsyncContext`, so every later item binds to the instance. A `.uf.tsx` parent prints `<Suspense>` around each use of an async child. A component whose whole render is an async child turns `inheritAttrs` off and binds `v-bind="$attrs"` on the child, since `<Suspense>` drops fallthrough. `defineExpose` comes before the first await, or the parent's ref keeps the bare proxy, and the functions it names print as declarations, which hoist.                                                                                                                                                                                                                                                                  |
| React   | emulated, `SetupPending` | A module-level `async function profileSetup({ id })` runs the awaits in order and returns the awaited values the component reads. The exported `Profile` starts it once, `useState(() => profileSetup(props))`, and renders `<Suspense fallback={<SetupPending … />}><ProfileResolved {...props} setup={setup} settled={settled} /></Suspense>`. `ProfileResolved` is the component, with `const { user } = use(setup)` first. `SetupPending` renders nothing, and its effect tells the component once the setup settles, so the content shows at once rather than after React's fallback throttle. It runs only where React commits the fallback, never while hydrating. The setup function takes only the props the awaits read. A name the source uses pushes the output's to `setup_1`. |
| Svelte  | native                   | Top-level `await` in the instance script, wrapped whole in `untrack`, under Svelte's `experimental.async`, which the toolchain sets per file, only for a module whose instance script awaits. Three kinds of item move above the awaits, since Svelte allows them only in the component's synchronous start: template refs, the `onMount` of `mounted` hooks, and each `provide` of props, module values and globals. A `provide` that reads an awaited value or a later item can't move: Svelte's `emit` reports UF1002 at it.                                                                                                                                                                                                                                                             |
| Solid   | native                   | One `createResource` whose fetcher runs the awaits in order and returns them. The template and every setup item after the awaits go in the function child of `<Show when={awaited()}>`, inside a `<Suspense>` with no fallback. `useId` items stay above the resource, so hydration keeps the server's ids. A slot's `children()` resolves inside the callback. The server render passes `noScripts`, so its HTML holds no resource data.                                                                                                                                                                                                                                                                                                                                                   |
| Angular | native                   | `ngOnInit` runs the setup inside `PendingTasks.run(async () => …)`, so the server and every settle wait for it. Each awaited value is a definitely assigned field, typed by its annotation or by `Awaited<ReturnType<…>>` of a method holding the call. After the awaits, the setup stops if the component was destroyed meanwhile, then runs the rest of `ngOnInit` and sets the `resolved` signal. The template sits in `@if (resolved()) { … }`, and `ngOnDestroy`'s hooks run only once it is set. Later items that read an awaited value are deferred as items that read an input are.                                                                                                                                                                                                 |
| Qwik    | native                   | Each await is an async `useComputed$` read in the body, in two statements: `const userLoad = useComputed$(() => untrack(() => loadUser(id))); const user = userLoad.value;`. Reading `.value` while pending throws the promise, and Qwik runs the body again once it settles. `untrack` appears only where the expression reads a prop. The one-statement form makes the optimiser write a module that fails to import, and an awaited value is never hoisted out of the component.                                                                                                                                                                                                                                                                                                         |
| Astro   | native                   | Top-level `await` in the frontmatter, which the Container API waits for. An await whose value no server code reads prints as `await loadUser(id);`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

The hydrated DOM while the setup runs again, per target:

| Target  | While the setup runs again                   | Once it resolves                                                       |
| ------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| Vue     | the server's nodes, inert                    | the same nodes hydrate                                                 |
| React   | the server's nodes, in a dehydrated boundary | the same nodes hydrate                                                 |
| Svelte  | the server's nodes                           | the same nodes                                                         |
| Solid   | the server's nodes                           | new nodes that read the same, so focus and selection inside them reset |
| Angular | the server's nodes, in a dehydrated `@if`    | the same nodes, claimed by the view                                    |
| Qwik    | skipped: `hydration` is unsupported          | resumption runs no setup again                                         |
| Astro   | skipped: static                              | nothing runs                                                           |

Declared differences, on the targets page:

- **React.** A prop update that arrives while the component hydrates and its setup is pending makes
  React render it on the client: the server's DOM goes, and nothing shows until the setup
  resolves, with no mismatch reported. Under `StrictMode` in development, the setup runs twice.
- **Solid.** The subtree is created again once the setup resolves after hydration. With the data
  Solid's server render ships by default, the client hydrates in place and doesn't run the setup
  again: only the `noScripts` path is tested. A rejected setup throws from the resource's read.
- **Svelte.** The host's `experimental.async`, and the UF1002 at a `provide` it can't move.

### The harness

1. **Vue's root.** `toolchain/client.ts` and `hydrate.ts` render the root inside `<Suspense>` when
   its `setup` is an async function, and only then, so no other case mounts through Suspense's
   hidden container.
2. **Svelte's props.** Svelte's async runtime, once on, is on for every later spec file on the
   page, and it forbids a write of state inside a template effect. The toolchain's props object
   makes a key's box at its first read, which a template effect may be, so each box starts with its
   value rather than being written after it is made (`state_unsafe_mutation` otherwise). The
   spec files keep sharing their pages in any order.
3. **The focus after `client agreement`.** A component that focuses as it mounts focuses its client
   render's copy too, which the check then removes. The client render gives the focus back to the
   element that held it, so the hydrated view keeps it. This amends ADR-0095.
4. **The canaries.** A text, attribute or statement a canary puts in a React output's template goes
   in `<Name>Resolved`, where an async component's template is: the exported component renders
   only `<Suspense>`. `L12-client-text` takes Solid's `DOM` sub-check as evidence too, as it does
   Svelte's and Angular's: Solid creates an async setup's subtree again from the client's render,
   so the hydrated DOM shows the client's text, and no mismatch is reported.
5. **Loaders resolve after a microtask.** Settling stops when two rounds read the same DOM, so a
   slower setup could read as settled while pending. The cases' loaders are deterministic and
   resolve after one `await Promise.resolve()`.

## Consequences

**Positive:**

- An async component compiles to the seven targets, and its server HTML holds the resolved data on
  each.
- The cases are `async-setup/resolved`, `async-setup/props`, `async-setup/chained`,
  `async-setup/nested`, `async-setup/rerun`, `async-setup/provide`, `diagnostics/nested-await` and
  `diagnostics/late-await`.

**Negative:**

- Vue and Svelte hosts each do one thing: a hand-written Vue parent supplies `<Suspense>`, and a
  Svelte host turns on an experimental compiler option.
- React's output carries three functions and an inline helper for each async component.
- Svelte's async runtime is page-wide, so a design system's other Svelte components run under it
  once one async component loads.

**Open:**

- An async component as a `<component is>` candidate.
- Error handling for a rejected setup.
- A UF7 host-option check for Svelte's `experimental.async`.
- Solid's serialised-data path, which the harness doesn't run.

## Alternatives considered

- **Vue without `<Suspense>`** (state, `onServerPrefetch` and a client re-run). Vue's first client
  render has no value, so it reports "Hydration node mismatch" and replaces the server's DOM.
  Keeping it would need the server's value on the client, which is a runtime.
- **React: `use(load())` in the body.** React makes a new promise on each retry and throws "async
  Client Component" after 100. State and an effect leave the server's HTML empty.
- **Solid: an inner component.** eslint-plugin-solid's `solid/reactivity` fails L5 on its props. A
  resource with no `<Suspense>` leaves the server's HTML empty.
- **Qwik: `useComputed$(…).value` in one statement.** The optimizer writes a duplicate `const` with
  two awaits.
- **The approved rule as written** (an `await` anywhere before the return). React, Solid, Qwik and
  Angular would report UF1002 for an `await` after other items, so such a component would compile
  on three targets only.
- **Svelte's `experimental.async` for every file.** It would change `tick()` and batching on every
  page a design system's tests load, async component or not.
