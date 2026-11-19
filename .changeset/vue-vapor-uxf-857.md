---
"@unframework.dev/codegen": minor
"@unframework.dev/compiler": minor
"@unframework.dev/diagnostics": minor
"@unframework.dev/target-vue": minor
"@unframework.dev/unplugin": minor
"@unframework.dev/cli": minor
"@unframework.dev/testing": minor
"@unframework.dev/visual": minor
"@uxfront/unframework": minor
---

Add Vue 3.6's Vapor components as an experimental option of the Vue target: `targetOptions: { vue: { vapor: true } }` in `unframework.config.ts` writes `<script setup vapor lang="ts">`, or `<template vapor>`, with directives as `VaporDirective` functions, and every other output stays as Vue's. `compile()` now validates `targetOptions` with each target's schema and throws `UF7004` for an invalid option, the unframework plugin takes a `targetOptions` option, and `defineTestConfig` and `unframework preview` pass the config's on, so the tests and the preview compile what `build` writes. The plugin and `build --package` report the new `UF7013` when Vapor would compile with a Vue older than 3.6, whose compiler ignores `vapor`. `@unframework.dev/codegen` adds `capabilitiesOf` and `Target.capabilitiesFor`, `@unframework.dev/target-vue` adds `vueOptions` and the `./toolchain/vapor` entries, `@unframework.dev/testing` adds `./vue-vapor` and `vue-vapor` to `NORMALIZE_TARGETS`, and `@uxfront/unframework/config` types the option as `VueTargetOptions`.
