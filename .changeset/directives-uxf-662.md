---
"@unframework.dev/analyzer": minor
"@unframework.dev/codegen": minor
"@unframework.dev/compiler": minor
"@unframework.dev/diagnostics": minor
"@unframework.dev/ir": minor
"@unframework.dev/target-angular": minor
"@unframework.dev/target-astro": minor
"@unframework.dev/target-qwik": minor
"@unframework.dev/target-react": minor
"@unframework.dev/target-solid": minor
"@unframework.dev/target-svelte": minor
"@unframework.dev/target-vue": minor
"@unframework.dev/unplugin": minor
"@uxfront/unframework": minor
---

Add directives, which package a behaviour an element takes, like a focus trap or a click outside. Declare one once with `defineDirective<T>({ mounted, updated, unmounted })` and apply it as `v-name={value}`. Its hooks run in the browser only, with a descendant's before its ancestor's, and `updated` runs only after a render that changes the value. Directives compile to all seven targets, and Astro renders the element without them.

`.uf.ts` modules may now export directives beside their composables, and each compiles to one module per target. A directive outside the canonical form is UF2037, `v-name` with no directive of that name is UF3055, and a directive on a component or with a value built in place is UF3056.
