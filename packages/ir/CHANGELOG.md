# @unframework.dev/ir

## 0.4.0

### Minor Changes

- bde7690: Add `isDev`, for code that runs only in a development build. Import it from `@uxfront/unframework` and write `if (isDev) { … }` at the top of the setup or in client code, to warn a component's author without shipping the warning: `if (isDev) { if (!label) console.warn("IconButton has no accessible name."); }`. Each target writes its framework's own check, which a production build drops: `process.env.NODE_ENV !== "production"` on React, Vue and Svelte, `isDev` from `solid-js/web`, `@solidjs/web` or `@qwik.dev/core/build` on Solid, Solid 2 and Qwik, `ngDevMode` on Angular and `import.meta.env.DEV` on Astro. Any other read of `isDev` is the new error UF2040. A React, Vue or Svelte server reads `process.env.NODE_ENV` as it runs, so start a production server with `NODE_ENV=production`.

  `ToolchainContext` takes an optional `mode`, `"production"` or `"development"`, which Qwik's `frameworkEmit` reads.

- bde7690: Pass a consumer's attributes, listeners and ref through to a component whose root is a `<component is>` over tags, on whichever tag renders. An attribute that every tag takes, like `id`, `title`, `aria-*` or `data-*`, and a DOM listener now land on the element that renders, where they used to be UF1002: `<Button href="#docs" id="docs" aria-describedby="hint" onClick={track} />`. An attribute that only some tags take is still UF1002, as `disabled` is on `<component is={href ? "a" : "button"}>`, since `<a>` doesn't take it: declare it as a prop and set it on the `<component is>`. A `ref` on such a component holds the element that renders, typed as the union of the tags' elements: `useTemplateRef<HTMLAnchorElement | HTMLButtonElement>()`.

  `ComponentApi` has a new field, `refTags`, the tags a ref may hold. Each target writes the rest its own way, which ADR-0122 records.

  On Angular, an element with a static attribute holding `{{` is printed where Angular binds nothing, so a child whose root is one takes nothing that falls through. A parent that passes it an attribute, a listener, `class` or `style` now gets UF1002 on Angular, where the Angular output used to drop it.

- bde7690: Pass a consumer's attributes, listeners and ref through to a component's root on every target. An attribute or a DOM listener a component doesn't declare now lands on its root element, or passes on to its root component, where it used to be UF3035 or UF3036: `<SaveButton id="save" aria-describedby="hint" type="submit" onFocus={track} />`. The consumer's value wins over the root's own, and `class` and `style` merge as before. A `ref` on a component that doesn't call `defineExpose` holds its root element, typed as that element: `useTemplateRef<HTMLButtonElement>()`. To put what a consumer passes on another element, set `defineOptions({ inheritAttrs: false })` and spread the props' rest on it, `function Field({ label, ...rest }: FieldProps)` with `<input {...rest} />`.

  Each target writes it its own way, which ADR-0118 records. Two changes to what the outputs declare:

  - React's `<Name>Attributes` is now a type alias of the root element's props, without the component's own.
  - Angular reserves `ufAttributes`, `ufListeners` and `ufElement` as prop names (UF2003), since a component that takes fallthrough declares them. A hand-written Angular consumer passes an attribute in `[ufAttributes]`, since one written on the host stays on the host.

## 0.3.0

### Minor Changes

- 348db69: Let a `<component is>` over tags be a component's root that a parent styles. A parent's `class` and `style` now merge into whichever tag renders, as into a one-element root, and so does a styled parent's scope attribute. An attribute that only some of the tags take, like `href` on `is={href ? "a" : "button"}`, is accepted and renders only on those tags, where it used to be UF3006. So one component can render a link or a button with one styled root.

  `ComponentApi.root` has a new value, `"dynamic"`, with the tags in `ComponentApi.rootTags`. `ComponentApi.rootUnlisted` marks a `<component is>` root whose tags the API can't read, and `DynamicNode.only` lists the attributes only some tags take. Code that switches on every value of `ComponentApi.root` must handle `"dynamic"`. React also compiles a listener on a `<component is>` over tags, which failed to emit before.

## 0.2.0

### Minor Changes

- de1d9d0: Add async setup: a component may be `async` and declare what it waits for as `const user = await loadUser(id)` at the top of its setup. The server renders what it loaded, a client mount renders once the setup resolves, and a hydrated page keeps the server's HTML while the setup runs again. Async components compile to all seven targets, and the JSX types accept one as a tag.

  An `await` that isn't the whole value of a top-level `const` is UF2038, and an `await` after another setup item, or one that reads more than props, module values and earlier awaits, is UF2039. An async component as a `<component is>` candidate is UF1002 for now.

  Two hosts do one thing each: a hand-written Vue parent wraps an async component in `<Suspense>`, and a Svelte app sets `compilerOptions.experimental.async` for the files that await. On Svelte, a `provide` that reads an awaited value is UF1002.

  `@unframework.dev/target-svelte`'s mount and hydrate adapters now make a prop's state without writing it, so a component mounted after an async one, in Svelte's async mode, no longer fails with `state_unsafe_mutation`.

  `@unframework.dev/testing`'s hydrate projects now give the focus back to the hydrated view after the client render they compare it with, so a component that focuses as it mounts keeps the focus.

- de1d9d0: Directives now work on each row a list renders, and in a scoped slot's fill, with a value that reads the row's item or the fill's props: `items.map((item) => <li key={item.id} v-tooltip={item.label}>…</li>)`. Each element runs its own hooks with its own value, on every target that runs directives. These two uses were UF1002 before.
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

## 0.1.1

### Patch Changes

- 561e45f: Point the `homepage` link npm shows for each package at https://unframework.dev, the site and its docs, in place of the package's README on GitHub.

## 0.1.0

### Minor Changes

- f47bb2d: First release. Unframework compiles one `.uf.tsx` component into native React, Vue, Svelte, Solid, Angular, Qwik and Astro components.
