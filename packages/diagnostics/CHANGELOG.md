# @unframework.dev/diagnostics

## 0.3.1

### Patch Changes

- 90d0393: Centre examples in the preview, and add an `@layout` tag. `unframework preview` and `preview build` now centre every example and component in its frame, with `1rem` of padding, so a small component no longer sits in a corner. This moves every existing example.

  `@layout` in an example's doc comment changes how it sits, the way `display: flex` would: `row` or `column`, `justify-*`, `align-*`, `wrap` and a gap, like `@layout column align-start gap`. The gap comes from a scale, `gap-xs`, `gap-sm`, `gap`, `gap-lg` and `gap-xl` (`0.25rem` to `2rem`), or as a length like `gap-12px`.

  `@layout none` gives the old full-width block back, without padding. `Example` gains `layout`, and a malformed value is UF7012, whose description now covers it. `unframework visual` doesn't read the tag, so captures and baselines stay the same.

## 0.3.0

### Minor Changes

- de1d9d0: Add async setup: a component may be `async` and declare what it waits for as `const user = await loadUser(id)` at the top of its setup. The server renders what it loaded, a client mount renders once the setup resolves, and a hydrated page keeps the server's HTML while the setup runs again. Async components compile to all seven targets, and the JSX types accept one as a tag.

  An `await` that isn't the whole value of a top-level `const` is UF2038, and an `await` after another setup item, or one that reads more than props, module values and earlier awaits, is UF2039. An async component as a `<component is>` candidate is UF1002 for now.

  Two hosts do one thing each: a hand-written Vue parent wraps an async component in `<Suspense>`, and a Svelte app sets `compilerOptions.experimental.async` for the files that await. On Svelte, a `provide` that reads an awaited value is UF1002.

  `@unframework.dev/target-svelte`'s mount and hydrate adapters now make a prop's state without writing it, so a component mounted after an async one, in Svelte's async mode, no longer fails with `state_unsafe_mutation`.

  `@unframework.dev/testing`'s hydrate projects now give the focus back to the hydrated view after the client render they compare it with, so a component that focuses as it mounts keeps the focus.

- de1d9d0: Check a directive's value against its type under the tsgo type oracle. TypeScript doesn't type a dashed JSX attribute, so `v-focus-trap={1}` type-checks where `vFocusTrap` takes `boolean`. With `typeOracle: "tsgo"`, the compiler now types each value where it is written, narrowed by its branch, and reports one of another type as UF6007, `directive-value-type`.

  The value takes the directive's type as its context, as in an assignment, so a template literal or a generic call is typed as the directive needs. The default syntactic oracle checks no value.

  `TypeOracle` gains an optional `checkDirectiveValues` query, which the tsgo adapter answers in one call per module from the source the caller compiles. `createTsgoOracle` takes two new options: `include`, the files its checker's project holds, and `readFile`, how its syntactic layer reads a file.

- de1d9d0: Add directives, which package a behaviour an element takes, like a focus trap or a click outside. Declare one once with `defineDirective<T>({ mounted, updated, unmounted })` and apply it as `v-name={value}`. Its hooks run in the browser only, with a descendant's before its ancestor's, and `updated` runs only after a render that changes the value. Directives compile to all seven targets, and Astro renders the element without them.

  `.uf.ts` modules may now export directives beside their composables, and each compiles to one module per target. A directive outside the canonical form is UF2037, `v-name` with no directive of that name is UF3055, and a directive on a component or with a value built in place is UF3056.

- de1d9d0: Add `innerHTML={markup}` on an HTML element, which sets its content to a string of markup on all seven targets, where it was UF1002. Every use warns that the markup isn't escaped (UF3051, `raw-html`), and children beside it, a void element or a text-only element is UF3052 (`raw-html-content`). Angular passes the markup through an inline `TrustedHtmlPipe`, so its sanitiser doesn't drop attributes the other targets keep.
- de1d9d0: Add `<Teleport to>`, which mounts one element at the end of another part of the page once the component has mounted, like a dialog or a toast. It compiles to all seven targets, and Astro renders nothing for it. The server renders none of it, and it unmounts with its component. A bound or empty `to` is UF3053, and content other than one element is UF3054.

  React packages now peer on `react-dom`, whose `createPortal` a `<Teleport>` needs.

  `@unframework.dev/testing` now captures what a view appends to `<body>`: the DOM, ARIA, geometry, screenshot and axe checks cover it after the view's container, and the view's queries reach what it holds. A test that leaves an element in `<body>` once its views are unmounted now fails, naming the element.

- de1d9d0: Add `<Transition name appear>`, which runs Vue's enter and leave classes on an element as a condition shows or hides it, so a stylesheet animates it. Its child is one element, or one conditional of elements, and a leaving element stays in its place until its transition ends. Transitions compile to all seven targets, the server renders the settled child, and Astro renders the settled child only.

  A child that isn't one element or one conditional of elements is UF3057, and a bound or empty `name` or a bound `appear` is UF3058.

  `@unframework.dev/testing` now waits, as it settles a page before each capture, until no transition or animation runs, for at most 2 seconds. One still running then fails the test.

  On Svelte and Solid, a directive with only an `unmounted` hook no longer imports `untrack` or reads its value, which their linters reported.

## 0.2.0

### Minor Changes

- 58736dd: Add example metadata. A doc comment on an example's default export now gives `unframework preview` its description, and `@category`, `@title` and `@order` set where the preview lists it, under what name and in what order. Without a comment, an example takes its category from its directory and its title from its file name, so `src/components/button/examples/ButtonColors` is `Colors` in `Button`. `Example` gains `category`, `title`, `description` and `order`, `Preview` gains `diagnostics`, and a malformed tag is the new warning UF7012, which the preview prints and then ignores. `unframework visual` doesn't read the comment, so ids, baselines and reports stay the same. Code that builds an `Example` by hand must now set `category` and `title`.

## 0.1.1

### Patch Changes

- 561e45f: Point the `homepage` link npm shows for each package at https://unframework.dev, the site and its docs, in place of the package's README on GitHub.

## 0.1.0

### Minor Changes

- f47bb2d: First release. Unframework compiles one `.uf.tsx` component into native React, Vue, Svelte, Solid, Angular, Qwik and Astro components.
