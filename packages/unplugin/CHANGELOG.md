# @unframework.dev/unplugin

## 0.4.0

### Minor Changes

- 18cd60b: Angular shares its helpers in `_unframework/` (ADR-0121). `ScopeAttributes`, `TextCaret`, `TrustedHtmlPipe`, `styleObject`, the model helpers, `queueHook` and one directive per listener event and option are modules of their own, which every component imports and lists in its `imports`. `Transition` and `TransitionRegion` stay inline, because `inject` finds a region across component hosts. `api.getCompiled` in the unplugin now also gives a shared helper module's text, so Angular's ngtsc reads each one and compiles it ahead of time.
- f29ccaa: A shared helper module's id in the unplugin now names its target: `<helper root>/_unframework/<target>/<file>`. Two plugins for different targets in one Vite server, like React and Solid islands in one Astro app, no longer share one module where both emit a helper of one name, such as `cx.ts`. Outputs still import `_unframework/<file>`, and `api.getCompiled` takes that path or the new id. Angular's ngtsc step and Astro's render server read the new ids.

  Angular shares its `Fallthrough` directive in `_unframework/` (ADR-0121), with the types of its listeners' record in `Listeners.ts`: `Listeners`, and `SvgListeners` for an SVG element. Each component that takes what its consumer passes imports them, the types with `import type`.

  `lintWithEslint` in `@unframework.dev/codegen/toolchain-node` sends ESLint its request on standard input, not as one command-line argument. A large file list no longer fails with `spawn E2BIG` on Linux.

- 487bad7: Helpers live in shared modules (ADR-0121). A target puts each helper it emits for a missing primitive through `EmitContext.helper` into one module per helper, `_unframework/<file>` at the root of the output tree, which every output imports. React shares its helpers this way, so a tree holds each once. `compile()` now returns the helper modules beside the components, lists their paths in `CompileResult.helpers`, and takes a `helperRoot` option. A caller that writes only the component files must write the helper modules too. The CLI writes each once per tree, `--package` carries them, and the unplugin loads each from one virtual id per graph, with a `helperRoot` option. UF1104 also covers a shared module that would take a helper module's place.

### Patch Changes

- Updated dependencies [bde7690]
- Updated dependencies [03b6dab]
- Updated dependencies [bde7690]
- Updated dependencies [bde7690]
- Updated dependencies [bde7690]
- Updated dependencies [f29ccaa]
- Updated dependencies [487bad7]
  - @unframework.dev/diagnostics@0.5.0
  - @unframework.dev/codegen@0.4.0
  - @unframework.dev/compiler@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [348db69]
  - @unframework.dev/codegen@0.3.0
  - @unframework.dev/diagnostics@0.4.0
  - @unframework.dev/compiler@0.3.2

## 0.3.0

### Minor Changes

- 60248fb: Add controls to an example in `unframework preview` and in a static preview. Selecting an example used to leave the controls panel empty, and now it shows a group for each component the example renders: a value reaches every instance that doesn't set the prop itself, so a colours example can toggle `disabled` and keep each button's colour. The preview rewrites the example for its own servers only, so `unframework visual` and the tests render it as written. It does so through the unframework plugin's new `transformSource` option, which gives the text to compile for a `.uf.tsx` or `.uf.ts` file in place of the one on disk.

### Patch Changes

- f4f2374: Serve a module's children without waiting on other files' compiles. When a module loads, the plugin now also compiles the `.uf.tsx` and `.uf.ts` files it imports, and theirs, so they are ready before anything requests them. A request for a file whose compile is still current no longer waits behind the compiles of unrelated files. On a busy dev server, Qwik's first render of a component with children took tens of seconds, because each of its segments waited in that line to resolve its imports.
- Updated dependencies [90d0393]
  - @unframework.dev/diagnostics@0.3.1
  - @unframework.dev/codegen@0.2.1
  - @unframework.dev/compiler@0.3.1

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
