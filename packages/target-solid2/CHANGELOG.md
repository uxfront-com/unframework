# @unframework.dev/target-solid2

## 0.3.0

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

- 0932da7: Solid and Solid 2 share their helpers in `_unframework/` (ADR-0121). A component, a composable and a directive module import `cx`, `styleProperties`, `scopeAttributes`, `modelText`, `selectOptions`, `nextTick`, `queueHook`, `KeyedFor` and `Transition` from their modules, and Solid also imports `Teleport`. Solid 2 also shares `createState`, `enumeratedValue` and `clearedRef`. A module that holds JSX is a `.tsx` file.

  The watchers and their scheduler stay inline, as do `restAttributes`, `textCaret`, `toggle` and `selectedValues`. On Solid 2, `Teleport` stays inline, and so does the `createState` of a component with watchers, whose write queues their flush. A context without `helper` still gets every helper inline.

### Patch Changes

- Updated dependencies [bde7690]
- Updated dependencies [bde7690]
- Updated dependencies [bde7690]
- Updated dependencies [f29ccaa]
- Updated dependencies [487bad7]
  - @unframework.dev/ir@0.4.0
  - @unframework.dev/codegen@0.4.0

## 0.2.0

### Minor Changes

- 348db69: Let a `<component is>` over tags be a component's root that a parent styles. A parent's `class` and `style` now merge into whichever tag renders, as into a one-element root, and so does a styled parent's scope attribute. An attribute that only some of the tags take, like `href` on `is={href ? "a" : "button"}`, is accepted and renders only on those tags, where it used to be UF3006. So one component can render a link or a button with one styled root.

  `ComponentApi.root` has a new value, `"dynamic"`, with the tags in `ComponentApi.rootTags`. `ComponentApi.rootUnlisted` marks a `<component is>` root whose tags the API can't read, and `DynamicNode.only` lists the attributes only some tags take. Code that switches on every value of `ComponentApi.root` must handle `"dynamic"`. React also compiles a listener on a `<component is>` over tags, which failed to emit before.

### Patch Changes

- Updated dependencies [348db69]
  - @unframework.dev/ir@0.3.0
  - @unframework.dev/codegen@0.3.0

## 0.1.1

### Patch Changes

- @unframework.dev/codegen@0.2.1

## 0.1.0

### Minor Changes

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
  - @unframework.dev/codegen@0.2.0
  - @unframework.dev/ir@0.2.0
