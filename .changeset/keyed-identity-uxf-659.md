---
"@unframework.dev/codegen": minor
"@unframework.dev/target-angular": minor
"@unframework.dev/target-astro": minor
"@unframework.dev/target-qwik": minor
"@unframework.dev/target-react": minor
"@unframework.dev/target-solid": minor
"@unframework.dev/target-svelte": minor
"@unframework.dev/target-vue": minor
---

Keep a keyed item's element while its list reorders, or replaces the item with another object of the same key, so the row keeps its typed text and state, and its focus where it keeps its place. A new capability, `keyed-identity`, declares it: native on React, Vue, Svelte, Angular and Qwik, emulated on Solid, whose list now goes through an inline `KeyedFor` that follows the source's `key`, and unsupported on Astro (UF4001, info), which renders a list once on the server.
