---
"@uxfront/unframework": minor
"@unframework.dev/ir": minor
"@unframework.dev/diagnostics": minor
"@unframework.dev/analyzer": minor
"@unframework.dev/codegen": minor
"@unframework.dev/compiler": minor
"@unframework.dev/target-react": minor
"@unframework.dev/target-vue": minor
"@unframework.dev/target-svelte": minor
"@unframework.dev/target-solid": minor
"@unframework.dev/target-solid2": minor
"@unframework.dev/target-angular": minor
"@unframework.dev/target-qwik": minor
"@unframework.dev/target-astro": minor
---

Add `isDev`, for code that runs only in a development build. Import it from `@uxfront/unframework` and write `if (isDev) { … }` at the top of the setup or in client code, to warn a component's author without shipping the warning: `if (isDev) { if (!label) console.warn("IconButton has no accessible name."); }`. Each target writes its framework's own check, which a production build drops: `process.env.NODE_ENV !== "production"` on React, Vue and Svelte, `isDev` from `solid-js/web`, `@solidjs/web` or `@qwik.dev/core/build` on Solid, Solid 2 and Qwik, `ngDevMode` on Angular and `import.meta.env.DEV` on Astro. Any other read of `isDev` is the new error UF2040. A React, Vue or Svelte server reads `process.env.NODE_ENV` as it runs, so start a production server with `NODE_ENV=production`.

`ToolchainContext` takes an optional `mode`, `"production"` or `"development"`, which Qwik's `frameworkEmit` reads.
