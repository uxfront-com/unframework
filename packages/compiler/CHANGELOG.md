# @unframework.dev/compiler

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
