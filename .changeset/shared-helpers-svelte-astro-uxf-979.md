---
"@unframework.dev/target-svelte": minor
"@unframework.dev/target-astro": minor
---

Svelte and Astro share their helpers in `_unframework/` (ADR-0121). Svelte's instance script imports `once`, `mergeStyle`, `styleText`, `scopeAttributes`, `teleport`, the transition set and `modelText` from their modules. `modelText` calls `$effect`, so its module is `modelText.svelte.ts`. Astro's frontmatter imports `scopeAttributes` and `styleObject`.

`refObject`, `restAttributes`, `uniqueId` and `withoutScope` stay inline. A context without `helper` still gets every helper inline. Astro's browser render command now serves a helper module that a component imports.
