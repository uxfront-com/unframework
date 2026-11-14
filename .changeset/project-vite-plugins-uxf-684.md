---
"@unframework.dev/compiler": minor
"@unframework.dev/testing": minor
"@unframework.dev/visual": minor
"@uxfront/unframework": minor
---

Add `vitePlugins`, `declarations` and `liveFonts` to `unframework.config.ts`, so a design system styled through an engine's Vite plugin, like Styleframe's, runs `unframework test`, `unframework visual` and `unframework preview` with no wrapper, where every `virtual:` import the engine serves failed to resolve before. `vitePlugins` is a function that returns the plugins, which every browser, server render and preview server calls for a set of its own, and `declarations` lists the files that type their modules, which Angular's compiler reads. `liveFonts: "any"` lets a live capture draw text in the project's own font, where only the bundled Inter passed before, and comparisons with baselines still audit every glyph. `@unframework.dev/testing/config` exports `projectPlugins`, and `@uxfront/unframework/config` the types `VitePluginOption` and `LiveFonts`.
