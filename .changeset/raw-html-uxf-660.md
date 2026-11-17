---
"@unframework.dev/analyzer": minor
"@unframework.dev/codegen": minor
"@unframework.dev/diagnostics": minor
"@unframework.dev/ir": minor
"@unframework.dev/target-angular": minor
"@unframework.dev/target-astro": minor
"@unframework.dev/target-qwik": minor
"@unframework.dev/target-react": minor
"@unframework.dev/target-svelte": minor
"@unframework.dev/target-solid": minor
"@unframework.dev/target-vue": minor
---

Add `innerHTML={markup}` on an HTML element, which sets its content to a string of markup on all seven targets, where it was UF1002. Every use warns that the markup isn't escaped (UF3051, `raw-html`), and children beside it, a void element or a text-only element is UF3052 (`raw-html-content`). Angular passes the markup through an inline `TrustedHtmlPipe`, so its sanitiser doesn't drop attributes the other targets keep.
