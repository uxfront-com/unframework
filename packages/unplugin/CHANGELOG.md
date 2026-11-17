# @unframework.dev/unplugin

## 0.2.0

### Minor Changes

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
  - @unframework.dev/codegen@0.2.0
  - @unframework.dev/diagnostics@0.3.0
  - @unframework.dev/compiler@0.3.0

## 0.1.4

### Patch Changes

- Updated dependencies [58736dd]
  - @unframework.dev/diagnostics@0.2.0
  - @unframework.dev/codegen@0.1.3
  - @unframework.dev/compiler@0.2.3

## 0.1.3

### Patch Changes

- 561e45f: Point the `homepage` link npm shows for each package at https://unframework.dev, the site and its docs, in place of the package's README on GitHub.
- Updated dependencies [561e45f]
  - @unframework.dev/codegen@0.1.2
  - @unframework.dev/compiler@0.2.2
  - @unframework.dev/diagnostics@0.1.1
  - @unframework.dev/parser@0.1.1

## 0.1.2

### Patch Changes

- Updated dependencies [51da760]
  - @unframework.dev/codegen@0.1.1
  - @unframework.dev/compiler@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [fc310cc]
  - @unframework.dev/compiler@0.2.0

## 0.1.0

### Minor Changes

- f47bb2d: First release. Unframework compiles one `.uf.tsx` component into native React, Vue, Svelte, Solid, Angular, Qwik and Astro components.

### Patch Changes

- Updated dependencies [f47bb2d]
  - @unframework.dev/codegen@0.1.0
  - @unframework.dev/compiler@0.1.0
  - @unframework.dev/diagnostics@0.1.0
  - @unframework.dev/parser@0.1.0
