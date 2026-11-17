# @unframework.dev/compiler

## 0.3.0

### Minor Changes

- de1d9d0: Check a directive's value against its type under the tsgo type oracle. TypeScript doesn't type a dashed JSX attribute, so `v-focus-trap={1}` type-checks where `vFocusTrap` takes `boolean`. With `typeOracle: "tsgo"`, the compiler now types each value where it is written, narrowed by its branch, and reports one of another type as UF6007, `directive-value-type`.

  The value takes the directive's type as its context, as in an assignment, so a template literal or a generic call is typed as the directive needs. The default syntactic oracle checks no value.

  `TypeOracle` gains an optional `checkDirectiveValues` query, which the tsgo adapter answers in one call per module from the source the caller compiles. `createTsgoOracle` takes two new options: `include`, the files its checker's project holds, and `readFile`, how its syntactic layer reads a file.

- de1d9d0: Add directives, which package a behaviour an element takes, like a focus trap or a click outside. Declare one once with `defineDirective<T>({ mounted, updated, unmounted })` and apply it as `v-name={value}`. Its hooks run in the browser only, with a descendant's before its ancestor's, and `updated` runs only after a render that changes the value. Directives compile to all seven targets, and Astro renders the element without them.

  `.uf.ts` modules may now export directives beside their composables, and each compiles to one module per target. A directive outside the canonical form is UF2037, `v-name` with no directive of that name is UF3055, and a directive on a component or with a value built in place is UF3056.

- de1d9d0: Add `solid@2`, a target for Solid 2. A project opts in with `targets: ["solid@2"]`: `solid` and `solid@1` still mean Solid 1, and the default targets stay the seven. Its output, tree and package subpath are named `solid2`.

  A configuration, `compile()`, the bundler plugin and `unframework test`, `visual` and `preview` take a target's framework and major as well as its name, and a major that doesn't exist names `solid@2`. On Vite, the plugin tells Solid 1's plugin from Solid 2's by the `solid-js` the app installs. `build --package` writes a `./solid2` subpath compiled by Solid 2's compiler, and a package with both Solid targets takes either `solid-js` major as its peer.

  A project that installs both Solid majors keeps Solid 2 in a directory of its own and points `package.resolveFrom.solid2` at it.

### Patch Changes

- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
  - @unframework.dev/analyzer@0.2.0
  - @unframework.dev/codegen@0.2.0
  - @unframework.dev/diagnostics@0.3.0
  - @unframework.dev/ir@0.2.0
  - @unframework.dev/target-angular@0.2.0
  - @unframework.dev/target-astro@0.2.0
  - @unframework.dev/target-qwik@0.2.0
  - @unframework.dev/target-react@0.2.0
  - @unframework.dev/target-solid@0.2.0
  - @unframework.dev/target-svelte@0.2.0
  - @unframework.dev/target-vue@0.2.0
  - @unframework.dev/type-oracle@0.2.0
  - @unframework.dev/target-solid2@0.1.0

## 0.2.3

### Patch Changes

- Updated dependencies [58736dd]
  - @unframework.dev/diagnostics@0.2.0
  - @unframework.dev/analyzer@0.1.2
  - @unframework.dev/codegen@0.1.3
  - @unframework.dev/target-angular@0.1.3
  - @unframework.dev/target-astro@0.1.3
  - @unframework.dev/target-qwik@0.1.3
  - @unframework.dev/target-react@0.1.3
  - @unframework.dev/target-solid@0.1.3
  - @unframework.dev/target-svelte@0.1.3
  - @unframework.dev/target-vue@0.1.3

## 0.2.2

### Patch Changes

- 561e45f: Point the `homepage` link npm shows for each package at https://unframework.dev, the site and its docs, in place of the package's README on GitHub.
- Updated dependencies [561e45f]
  - @unframework.dev/analyzer@0.1.1
  - @unframework.dev/codegen@0.1.2
  - @unframework.dev/diagnostics@0.1.1
  - @unframework.dev/ir@0.1.1
  - @unframework.dev/parser@0.1.1
  - @unframework.dev/target-angular@0.1.2
  - @unframework.dev/target-astro@0.1.2
  - @unframework.dev/target-qwik@0.1.2
  - @unframework.dev/target-react@0.1.2
  - @unframework.dev/target-solid@0.1.2
  - @unframework.dev/target-svelte@0.1.2
  - @unframework.dev/target-vue@0.1.2
  - @unframework.dev/type-oracle@0.1.1

## 0.2.1

### Patch Changes

- Updated dependencies [51da760]
  - @unframework.dev/codegen@0.1.1
  - @unframework.dev/target-angular@0.1.1
  - @unframework.dev/target-astro@0.1.1
  - @unframework.dev/target-qwik@0.1.1
  - @unframework.dev/target-react@0.1.1
  - @unframework.dev/target-solid@0.1.1
  - @unframework.dev/target-svelte@0.1.1
  - @unframework.dev/target-vue@0.1.1

## 0.2.0

### Minor Changes

- fc310cc: Add `vite` and `liveFonts` to `unframework.config.ts`, so a design system styled through an engine's Vite plugin, like Styleframe's, runs `unframework test`, `unframework visual` and `unframework preview` with no wrapper, where every `virtual:` import the engine serves failed to resolve before. `vite` is a function that each browser, server render and preview server calls with its `{ target, mode }`: its plugins are listed before Unframework's, every other key, like `optimizeDeps.include`, merges into the server's own config, the keys a server owns, like `root` or `server.host`, are refused, and Angular's compile declares every `virtual:` module itself, so a project needs no type file. `liveFonts` lists the font families a live capture may draw text in besides the bundled Inter, while a comparison with baselines still takes Inter alone. `@unframework.dev/testing/config` exports `withProjectVite`, `projectPlugins` and `passThroughDeclarations`, `@unframework.dev/compiler` exports `DEFAULT_PASS_THROUGH`, and `@uxfront/unframework/config` exports the types `ProjectViteConfig`, `ViteContext`, `ViteMode` and `VitePluginOption`.

## 0.1.0

### Minor Changes

- f47bb2d: First release. Unframework compiles one `.uf.tsx` component into native React, Vue, Svelte, Solid, Angular, Qwik and Astro components.

### Patch Changes

- Updated dependencies [f47bb2d]
  - @unframework.dev/analyzer@0.1.0
  - @unframework.dev/codegen@0.1.0
  - @unframework.dev/diagnostics@0.1.0
  - @unframework.dev/ir@0.1.0
  - @unframework.dev/parser@0.1.0
  - @unframework.dev/target-angular@0.1.0
  - @unframework.dev/target-astro@0.1.0
  - @unframework.dev/target-qwik@0.1.0
  - @unframework.dev/target-react@0.1.0
  - @unframework.dev/target-solid@0.1.0
  - @unframework.dev/target-svelte@0.1.0
  - @unframework.dev/target-vue@0.1.0
  - @unframework.dev/type-oracle@0.1.0
