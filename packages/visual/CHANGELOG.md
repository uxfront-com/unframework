# @unframework.dev/visual

## 0.3.0

### Minor Changes

- 58736dd: Add example metadata. A doc comment on an example's default export now gives `unframework preview` its description, and `@category`, `@title` and `@order` set where the preview lists it, under what name and in what order. Without a comment, an example takes its category from its directory and its title from its file name, so `src/components/button/examples/ButtonColors` is `Colors` in `Button`. `Example` gains `category`, `title`, `description` and `order`, `Preview` gains `diagnostics`, and a malformed tag is the new warning UF7012, which the preview prints and then ignores. `unframework visual` doesn't read the comment, so ids, baselines and reports stay the same. Code that builds an `Example` by hand must now set `category` and `title`.
- 58736dd: The preview has a new page. Its sidebar holds your examples as a tree of their categories, with a filter, and your components below them. The canvas shows the selection's title and description, with every target side by side or one at a time, and a docked panel holds the controls. The page follows your system's light or dark setting, keeps the theme you pick, and works from the keyboard: press `?` to list the shortcuts.
- 58736dd: Add `unframework preview build`, which writes the preview as a static site that any static host serves at any path, and `buildPreview` in `@unframework.dev/visual`, which the command runs. Each target's frame is built with Vite on its dev server's configuration, and Astro is rendered at build time with each entry's initial props.

### Patch Changes

- Updated dependencies [58736dd]
  - @unframework.dev/diagnostics@0.2.0
  - @unframework.dev/codegen@0.1.3
  - @unframework.dev/compiler@0.2.3
  - @unframework.dev/unplugin@0.1.4
  - @unframework.dev/testing@0.2.3

## 0.2.2

### Patch Changes

- 561e45f: Point the `homepage` link npm shows for each package at https://unframework.dev, the site and its docs, in place of the package's README on GitHub.
- Updated dependencies [561e45f]
  - @unframework.dev/codegen@0.1.2
  - @unframework.dev/compiler@0.2.2
  - @unframework.dev/diagnostics@0.1.1
  - @unframework.dev/ir@0.1.1
  - @unframework.dev/testing@0.2.2
  - @unframework.dev/unplugin@0.1.3

## 0.2.1

### Patch Changes

- Updated dependencies [51da760]
  - @unframework.dev/codegen@0.1.1
  - @unframework.dev/compiler@0.2.1
  - @unframework.dev/testing@0.2.1
  - @unframework.dev/unplugin@0.1.2

## 0.2.0

### Minor Changes

- fc310cc: Add `vite` and `liveFonts` to `unframework.config.ts`, so a design system styled through an engine's Vite plugin, like Styleframe's, runs `unframework test`, `unframework visual` and `unframework preview` with no wrapper, where every `virtual:` import the engine serves failed to resolve before. `vite` is a function that each browser, server render and preview server calls with its `{ target, mode }`: its plugins are listed before Unframework's, every other key, like `optimizeDeps.include`, merges into the server's own config, the keys a server owns, like `root` or `server.host`, are refused, and Angular's compile declares every `virtual:` module itself, so a project needs no type file. `liveFonts` lists the font families a live capture may draw text in besides the bundled Inter, while a comparison with baselines still takes Inter alone. `@unframework.dev/testing/config` exports `withProjectVite`, `projectPlugins` and `passThroughDeclarations`, `@unframework.dev/compiler` exports `DEFAULT_PASS_THROUGH`, and `@uxfront/unframework/config` exports the types `ProjectViteConfig`, `ViteContext`, `ViteMode` and `VitePluginOption`.

### Patch Changes

- Updated dependencies [fc310cc]
  - @unframework.dev/compiler@0.2.0
  - @unframework.dev/testing@0.2.0
  - @unframework.dev/unplugin@0.1.1

## 0.1.0

### Minor Changes

- f47bb2d: First release. Unframework compiles one `.uf.tsx` component into native React, Vue, Svelte, Solid, Angular, Qwik and Astro components.

### Patch Changes

- Updated dependencies [f47bb2d]
  - @unframework.dev/codegen@0.1.0
  - @unframework.dev/compiler@0.1.0
  - @unframework.dev/diagnostics@0.1.0
  - @unframework.dev/ir@0.1.0
  - @unframework.dev/testing@0.1.0
  - @unframework.dev/unplugin@0.1.0
