# @unframework.dev/cli

## 0.3.2

### Patch Changes

- @unframework.dev/compiler@0.4.2

## 0.3.1

### Patch Changes

- @unframework.dev/compiler@0.4.1

## 0.3.0

### Minor Changes

- 487bad7: Helpers live in shared modules (ADR-0121). A target puts each helper it emits for a missing primitive through `EmitContext.helper` into one module per helper, `_unframework/<file>` at the root of the output tree, which every output imports. React shares its helpers this way, so a tree holds each once. `compile()` now returns the helper modules beside the components, lists their paths in `CompileResult.helpers`, and takes a `helperRoot` option. A caller that writes only the component files must write the helper modules too. The CLI writes each once per tree, `--package` carries them, and the unplugin loads each from one virtual id per graph, with a `helperRoot` option. UF1104 also covers a shared module that would take a helper module's place.

### Patch Changes

- Updated dependencies [bde7690]
- Updated dependencies [03b6dab]
- Updated dependencies [bde7690]
- Updated dependencies [bde7690]
- Updated dependencies [bde7690]
- Updated dependencies [487bad7]
  - @unframework.dev/diagnostics@0.5.0
  - @unframework.dev/compiler@0.4.0

## 0.2.2

### Patch Changes

- Updated dependencies [348db69]
  - @unframework.dev/diagnostics@0.4.0
  - @unframework.dev/compiler@0.3.2

## 0.2.1

### Patch Changes

- Updated dependencies [90d0393]
  - @unframework.dev/diagnostics@0.3.1
  - @unframework.dev/compiler@0.3.1

## 0.2.0

### Minor Changes

- de1d9d0: Add `solid@2`, a target for Solid 2. A project opts in with `targets: ["solid@2"]`: `solid` and `solid@1` still mean Solid 1, and the default targets stay the seven. Its output, tree and package subpath are named `solid2`.

  A configuration, `compile()`, the bundler plugin and `unframework test`, `visual` and `preview` take a target's framework and major as well as its name, and a major that doesn't exist names `solid@2`. On Vite, the plugin tells Solid 1's plugin from Solid 2's by the `solid-js` the app installs. `build --package` writes a `./solid2` subpath compiled by Solid 2's compiler, and a package with both Solid targets takes either `solid-js` major as its peer.

  A project that installs both Solid majors keeps Solid 2 in a directory of its own and points `package.resolveFrom.solid2` at it.

- de1d9d0: Add `<Teleport to>`, which mounts one element at the end of another part of the page once the component has mounted, like a dialog or a toast. It compiles to all seven targets, and Astro renders nothing for it. The server renders none of it, and it unmounts with its component. A bound or empty `to` is UF3053, and content other than one element is UF3054.

  React packages now peer on `react-dom`, whose `createPortal` a `<Teleport>` needs.

  `@unframework.dev/testing` now captures what a view appends to `<body>`: the DOM, ARIA, geometry, screenshot and axe checks cover it after the view's container, and the view's queries reach what it holds. A test that leaves an element in `<body>` once its views are unmounted now fails, naming the element.

### Patch Changes

- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
  - @unframework.dev/diagnostics@0.3.0
  - @unframework.dev/compiler@0.3.0
  - @unframework.dev/type-oracle-tsgo@0.2.0

## 0.1.5

### Patch Changes

- Updated dependencies [58736dd]
  - @unframework.dev/diagnostics@0.2.0
  - @unframework.dev/compiler@0.2.3

## 0.1.4

### Patch Changes

- 561e45f: Point the `homepage` link npm shows for each package at https://unframework.dev, the site and its docs, in place of the package's README on GitHub.
- Updated dependencies [561e45f]
  - @unframework.dev/compiler@0.2.2
  - @unframework.dev/diagnostics@0.1.1
  - @unframework.dev/parser@0.1.1
  - @unframework.dev/type-oracle-tsgo@0.1.2

## 0.1.3

### Patch Changes

- 6b7c023: Keep `unframework build --package` working on TypeScript 7.1 for React and Solid. Declarations are named `Card.d.ts` again, not `Card.d.d.ts`, and UF7009 carries tsgo's declaration error again, which 7.1 builds used to pass silently. On TypeScript 7.1, install tsdown `0.23.7` or later.
- Updated dependencies [6b7c023]
  - @unframework.dev/type-oracle-tsgo@0.1.1

## 0.1.2

### Patch Changes

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
  - @unframework.dev/compiler@0.1.0
  - @unframework.dev/diagnostics@0.1.0
  - @unframework.dev/parser@0.1.0
  - @unframework.dev/type-oracle-tsgo@0.1.0
