---
"@unframework.dev/analyzer": minor
"@uxfront/unframework": minor
"@unframework.dev/diagnostics": patch
"@unframework.dev/codegen": patch
"@unframework.dev/parser": patch
"@unframework.dev/type-oracle": patch
"@unframework.dev/unplugin": patch
"@unframework.dev/visual": patch
---

Update the compiler's toolchain: `vite` 8.3.8, `rolldown` 1.3.3, `unplugin` 3.7.0, `astro` 7.4.13, `oxc-parser`, `oxc-codegen` and `@oxc-project/types` 0.160.0, and `@typescript-eslint/scope-manager` 8.74.0. `@unframework.dev/codegen` takes the oxc packages and the `vite` peer, `@unframework.dev/parser` and `@unframework.dev/type-oracle` take `oxc-parser`, `@unframework.dev/analyzer` takes the scope manager, `@unframework.dev/unplugin` takes `unplugin` and the `vite` and `astro` peers, and `@unframework.dev/visual` takes the `vite` peer. The compiled output doesn't change.

Since oxc 0.155, oxc's JSX decodes a surrogate reference as Babel and esbuild do, so the analyser now reads them the same way (ADR-0127). A surrogate pair written as two references, like `&#xD83D;&#xDE00;`, reads as 😀 with no diagnostic. A lone one, like `&#xD83D;`, is UF3010, as a raw lone surrogate already was, instead of UF3009.
