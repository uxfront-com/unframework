# @unframework.dev/visual

## 0.5.0

### Minor Changes

- cbee4db: Let an embedded example show its controls, take a colour mode and report its height. `embed.html` takes three optional parameters, and any other value shows a message that names the values it takes. Without them, an embed is unchanged.

  `controls=true` shows the example's controls below it, with the preview's props rule, and keeps their styles apart from the project's. `theme=light` or `theme=dark` sets `data-theme` and `color-scheme` on the embed's page before it renders, and the page that frames it can change the mode with `{ type: "unframework:embed", kind: "theme", theme }`. `resize=true` posts `{ type: "unframework:embed", kind: "resize", height }` to that page whenever the content's height changes, so it can size the `<iframe>`.

- 103d33c: Open an example by its own URL, so another page can show it in an `<iframe>`. `embed.html?example=<id>&target=<target>`, beside the preview's page in a static site from `unframework preview build` and on the dev preview's server, shows that example alone on that target, with no sidebar, canvas or controls. It takes no messages from the page that frames it, and an unknown or missing example or target shows a message instead of a blank page. Each frame's caption in the preview now has an **Open** link to the selected example's URL on that target.
- 60248fb: Add controls to an example in `unframework preview` and in a static preview. Selecting an example used to leave the controls panel empty, and now it shows a group for each component the example renders: a value reaches every instance that doesn't set the prop itself, so a colours example can toggle `disabled` and keep each button's colour. The preview rewrites the example for its own servers only, so `unframework visual` and the tests render it as written. It does so through the unframework plugin's new `transformSource` option, which gives the text to compile for a `.uf.tsx` or `.uf.ts` file in place of the one on disk.
- 90d0393: Centre examples in the preview, and add an `@layout` tag. `unframework preview` and `preview build` now centre every example and component in its frame, with `1rem` of padding, so a small component no longer sits in a corner. This moves every existing example.

  `@layout` in an example's doc comment changes how it sits, the way `display: flex` would: `row` or `column`, `justify-*`, `align-*`, `wrap` and a gap, like `@layout column align-start gap`. The gap comes from a scale, `gap-xs`, `gap-sm`, `gap`, `gap-lg` and `gap-xl` (`0.25rem` to `2rem`), or as a length like `gap-12px`.

  `@layout none` gives the old full-width block back, without padding. `Example` gains `layout`, and a malformed value is UF7012, whose description now covers it. `unframework visual` doesn't read the tag, so captures and baselines stay the same.

### Patch Changes

- Updated dependencies [60248fb]
- Updated dependencies [90d0393]
- Updated dependencies [f4f2374]
  - @unframework.dev/unplugin@0.3.0
  - @unframework.dev/diagnostics@0.3.1
  - @unframework.dev/testing@0.3.1
  - @unframework.dev/codegen@0.2.1
  - @unframework.dev/compiler@0.3.1

## 0.4.0

### Minor Changes

- 2f1bd19: Show a one-target preview at the canvas's full size. `unframework preview --target <t>`, and a static preview built for one target, now open with its frame across the whole canvas, as picking one target in a wider preview does, and leave out the **Targets** switch, which has nothing to choose. A preview of two or more targets still opens on **All**.
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
  - @unframework.dev/ir@0.2.0
  - @unframework.dev/testing@0.3.0
  - @unframework.dev/compiler@0.3.0
  - @unframework.dev/unplugin@0.2.0

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
