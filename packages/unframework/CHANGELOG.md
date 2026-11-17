# @uxfront/unframework

## 0.4.0

### Minor Changes

- de1d9d0: Add async setup: a component may be `async` and declare what it waits for as `const user = await loadUser(id)` at the top of its setup. The server renders what it loaded, a client mount renders once the setup resolves, and a hydrated page keeps the server's HTML while the setup runs again. Async components compile to all seven targets, and the JSX types accept one as a tag.

  An `await` that isn't the whole value of a top-level `const` is UF2038, and an `await` after another setup item, or one that reads more than props, module values and earlier awaits, is UF2039. An async component as a `<component is>` candidate is UF1002 for now.

  Two hosts do one thing each: a hand-written Vue parent wraps an async component in `<Suspense>`, and a Svelte app sets `compilerOptions.experimental.async` for the files that await. On Svelte, a `provide` that reads an awaited value is UF1002.

  `@unframework.dev/target-svelte`'s mount and hydrate adapters now make a prop's state without writing it, so a component mounted after an async one, in Svelte's async mode, no longer fails with `state_unsafe_mutation`.

  `@unframework.dev/testing`'s hydrate projects now give the focus back to the hydrated view after the client render they compare it with, so a component that focuses as it mounts keeps the focus.

- de1d9d0: Add directives, which package a behaviour an element takes, like a focus trap or a click outside. Declare one once with `defineDirective<T>({ mounted, updated, unmounted })` and apply it as `v-name={value}`. Its hooks run in the browser only, with a descendant's before its ancestor's, and `updated` runs only after a render that changes the value. Directives compile to all seven targets, and Astro renders the element without them.

  `.uf.ts` modules may now export directives beside their composables, and each compiles to one module per target. A directive outside the canonical form is UF2037, `v-name` with no directive of that name is UF3055, and a directive on a component or with a value built in place is UF3056.

- de1d9d0: Add `solid@2`, a target for Solid 2. A project opts in with `targets: ["solid@2"]`: `solid` and `solid@1` still mean Solid 1, and the default targets stay the seven. Its output, tree and package subpath are named `solid2`.

  A configuration, `compile()`, the bundler plugin and `unframework test`, `visual` and `preview` take a target's framework and major as well as its name, and a major that doesn't exist names `solid@2`. On Vite, the plugin tells Solid 1's plugin from Solid 2's by the `solid-js` the app installs. `build --package` writes a `./solid2` subpath compiled by Solid 2's compiler, and a package with both Solid targets takes either `solid-js` major as its peer.

  A project that installs both Solid majors keeps Solid 2 in a directory of its own and points `package.resolveFrom.solid2` at it.

- de1d9d0: Add `<Teleport to>`, which mounts one element at the end of another part of the page once the component has mounted, like a dialog or a toast. It compiles to all seven targets, and Astro renders nothing for it. The server renders none of it, and it unmounts with its component. A bound or empty `to` is UF3053, and content other than one element is UF3054.

  React packages now peer on `react-dom`, whose `createPortal` a `<Teleport>` needs.

  `@unframework.dev/testing` now captures what a view appends to `<body>`: the DOM, ARIA, geometry, screenshot and axe checks cover it after the view's container, and the view's queries reach what it holds. A test that leaves an element in `<body>` once its views are unmounted now fails, naming the element.

- de1d9d0: Add `<Transition name appear>`, which runs Vue's enter and leave classes on an element as a condition shows or hides it, so a stylesheet animates it. Its child is one element, or one conditional of elements, and a leaving element stays in its place until its transition ends. Transitions compile to all seven targets, the server renders the settled child, and Astro renders the settled child only.

  A child that isn't one element or one conditional of elements is UF3057, and a bound or empty `name` or a bound `appear` is UF3058.

  `@unframework.dev/testing` now waits, as it settles a page before each capture, until no transition or animation runs, for at most 2 seconds. One still running then fails the test.

  On Svelte and Solid, a directive with only an `unmounted` hook no longer imports `untrack` or reads its value, which their linters reported.

### Patch Changes

- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [2f1bd19]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
  - @unframework.dev/testing@0.3.0
  - @unframework.dev/compiler@0.3.0
  - @unframework.dev/visual@0.4.0
  - @unframework.dev/cli@0.2.0

## 0.3.0

### Minor Changes

- 58736dd: Add `unframework preview build`, which writes the preview as a static site that any static host serves at any path, and `buildPreview` in `@unframework.dev/visual`, which the command runs. Each target's frame is built with Vite on its dev server's configuration, and Astro is rendered at build time with each entry's initial props.

### Patch Changes

- Updated dependencies [58736dd]
- Updated dependencies [58736dd]
- Updated dependencies [58736dd]
  - @unframework.dev/visual@0.3.0
  - @unframework.dev/cli@0.1.5
  - @unframework.dev/compiler@0.2.3
  - @unframework.dev/testing@0.2.3

## 0.2.3

### Patch Changes

- 561e45f: Point the `homepage` link npm shows for each package at https://unframework.dev, the site and its docs, in place of the package's README on GitHub.
- Updated dependencies [561e45f]
  - @unframework.dev/cli@0.1.4
  - @unframework.dev/compiler@0.2.2
  - @unframework.dev/testing@0.2.2
  - @unframework.dev/visual@0.2.2

## 0.2.2

### Patch Changes

- Updated dependencies [6b7c023]
  - @unframework.dev/cli@0.1.3

## 0.2.1

### Patch Changes

- @unframework.dev/compiler@0.2.1
  - @unframework.dev/testing@0.2.1
  - @unframework.dev/visual@0.2.1
  - @unframework.dev/cli@0.1.2

## 0.2.0

### Minor Changes

- fc310cc: Add `vite` and `liveFonts` to `unframework.config.ts`, so a design system styled through an engine's Vite plugin, like Styleframe's, runs `unframework test`, `unframework visual` and `unframework preview` with no wrapper, where every `virtual:` import the engine serves failed to resolve before. `vite` is a function that each browser, server render and preview server calls with its `{ target, mode }`: its plugins are listed before Unframework's, every other key, like `optimizeDeps.include`, merges into the server's own config, the keys a server owns, like `root` or `server.host`, are refused, and Angular's compile declares every `virtual:` module itself, so a project needs no type file. `liveFonts` lists the font families a live capture may draw text in besides the bundled Inter, while a comparison with baselines still takes Inter alone. `@unframework.dev/testing/config` exports `withProjectVite`, `projectPlugins` and `passThroughDeclarations`, `@unframework.dev/compiler` exports `DEFAULT_PASS_THROUGH`, and `@uxfront/unframework/config` exports the types `ProjectViteConfig`, `ViteContext`, `ViteMode` and `VitePluginOption`.

### Patch Changes

- Updated dependencies [fc310cc]
  - @unframework.dev/compiler@0.2.0
  - @unframework.dev/testing@0.2.0
  - @unframework.dev/visual@0.2.0
  - @unframework.dev/cli@0.1.1

## 0.1.0

### Minor Changes

- f47bb2d: First release. Unframework compiles one `.uf.tsx` component into native React, Vue, Svelte, Solid, Angular, Qwik and Astro components.

### Patch Changes

- Updated dependencies [f47bb2d]
  - @unframework.dev/cli@0.1.0
  - @unframework.dev/compiler@0.1.0
  - @unframework.dev/testing@0.1.0
  - @unframework.dev/visual@0.1.0
