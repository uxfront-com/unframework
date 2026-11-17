---
"@unframework.dev/visual": minor
"@uxfront/unframework": minor
---

Add `unframework preview build`, which writes the preview as a static site that any static host serves at any path, and `buildPreview` in `@unframework.dev/visual`, which the command runs. Each target's frame is built with Vite on its dev server's configuration, and Astro is rendered at build time with each entry's initial props.
