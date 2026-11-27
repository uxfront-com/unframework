# @unframework.dev/compiler

## 0.4.0

### Minor Changes

- bde7690: Add `isDev`, for code that runs only in a development build. Import it from `@uxfront/unframework` and write `if (isDev) { … }` at the top of the setup or in client code, to warn a component's author without shipping the warning: `if (isDev) { if (!label) console.warn("IconButton has no accessible name."); }`. Each target writes its framework's own check, which a production build drops: `process.env.NODE_ENV !== "production"` on React, Vue and Svelte, `isDev` from `solid-js/web`, `@solidjs/web` or `@qwik.dev/core/build` on Solid, Solid 2 and Qwik, `ngDevMode` on Angular and `import.meta.env.DEV` on Astro. Any other read of `isDev` is the new error UF2040. A React, Vue or Svelte server reads `process.env.NODE_ENV` as it runs, so start a production server with `NODE_ENV=production`.

  `ToolchainContext` takes an optional `mode`, `"production"` or `"development"`, which Qwik's `frameworkEmit` reads.

- bde7690: Pass a consumer's attributes, listeners and ref through to a component's root on every target. An attribute or a DOM listener a component doesn't declare now lands on its root element, or passes on to its root component, where it used to be UF3035 or UF3036: `<SaveButton id="save" aria-describedby="hint" type="submit" onFocus={track} />`. The consumer's value wins over the root's own, and `class` and `style` merge as before. A `ref` on a component that doesn't call `defineExpose` holds its root element, typed as that element: `useTemplateRef<HTMLButtonElement>()`. To put what a consumer passes on another element, set `defineOptions({ inheritAttrs: false })` and spread the props' rest on it, `function Field({ label, ...rest }: FieldProps)` with `<input {...rest} />`.

  Each target writes it its own way, which ADR-0118 records. Two changes to what the outputs declare:

  - React's `<Name>Attributes` is now a type alias of the root element's props, without the component's own.
  - Angular reserves `ufAttributes`, `ufListeners` and `ufElement` as prop names (UF2003), since a component that takes fallthrough declares them. A hand-written Angular consumer passes an attribute in `[ufAttributes]`, since one written on the host stays on the host.

- 487bad7: Helpers live in shared modules (ADR-0121). A target puts each helper it emits for a missing primitive through `EmitContext.helper` into one module per helper, `_unframework/<file>` at the root of the output tree, which every output imports. React shares its helpers this way, so a tree holds each once. `compile()` now returns the helper modules beside the components, lists their paths in `CompileResult.helpers`, and takes a `helperRoot` option. A caller that writes only the component files must write the helper modules too. The CLI writes each once per tree, `--package` carries them, and the unplugin loads each from one virtual id per graph, with a `helperRoot` option. UF1104 also covers a shared module that would take a helper module's place.

### Patch Changes

- bde7690: Read each file once while a compile, an update, a `resolve()` or a `resolve.cycle()` is in flight. A project read a file again for every path that reached it: as a child, in each import cycle search and in the compile itself, so a page with five imports in cycles read some files seven times. Each file's text is now kept until the work in flight ends, so `readFile` runs once per file, a slow disk costs one wait per file, and one compile sees one version of each file. The next compile or update reads the files again.
- Updated dependencies [bde7690]
- Updated dependencies [03b6dab]
- Updated dependencies [bde7690]
- Updated dependencies [bde7690]
- Updated dependencies [18cd60b]
- Updated dependencies [f29ccaa]
- Updated dependencies [3c69c42]
- Updated dependencies [487bad7]
- Updated dependencies [0932da7]
- Updated dependencies [d051eaa]
  - @unframework.dev/ir@0.4.0
  - @unframework.dev/diagnostics@0.5.0
  - @unframework.dev/analyzer@0.4.0
  - @unframework.dev/codegen@0.4.0
  - @unframework.dev/target-react@0.4.0
  - @unframework.dev/target-vue@0.3.0
  - @unframework.dev/target-svelte@0.4.0
  - @unframework.dev/target-solid@0.4.0
  - @unframework.dev/target-solid2@0.3.0
  - @unframework.dev/target-angular@0.4.0
  - @unframework.dev/target-qwik@0.4.0
  - @unframework.dev/target-astro@0.4.0

## 0.3.2

### Patch Changes

- Updated dependencies [348db69]
  - @unframework.dev/ir@0.3.0
  - @unframework.dev/analyzer@0.3.0
  - @unframework.dev/codegen@0.3.0
  - @unframework.dev/diagnostics@0.4.0
  - @unframework.dev/target-react@0.3.0
  - @unframework.dev/target-svelte@0.3.0
  - @unframework.dev/target-solid@0.3.0
  - @unframework.dev/target-solid2@0.2.0
  - @unframework.dev/target-angular@0.3.0
  - @unframework.dev/target-qwik@0.3.0
  - @unframework.dev/target-astro@0.3.0
  - @unframework.dev/target-vue@0.2.2

## 0.3.1

### Patch Changes

- Updated dependencies [90d0393]
  - @unframework.dev/diagnostics@0.3.1
  - @unframework.dev/analyzer@0.2.1
  - @unframework.dev/codegen@0.2.1
  - @unframework.dev/target-angular@0.2.1
  - @unframework.dev/target-astro@0.2.1
  - @unframework.dev/target-qwik@0.2.1
  - @unframework.dev/target-react@0.2.1
  - @unframework.dev/target-solid@0.2.1
  - @unframework.dev/target-solid2@0.1.1
  - @unframework.dev/target-svelte@0.2.1
  - @unframework.dev/target-vue@0.2.1

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
