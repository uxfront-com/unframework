---
"@unframework.dev/analyzer": minor
"@unframework.dev/codegen": minor
"@unframework.dev/diagnostics": minor
"@unframework.dev/ir": minor
"@unframework.dev/target-angular": minor
"@unframework.dev/target-astro": minor
"@unframework.dev/target-qwik": minor
"@unframework.dev/target-react": minor
"@unframework.dev/target-solid": minor
"@unframework.dev/target-svelte": minor
"@unframework.dev/target-vue": minor
"@unframework.dev/testing": minor
"@uxfront/unframework": minor
---

Add `<Transition name appear>`, which runs Vue's enter and leave classes on an element as a condition shows or hides it, so a stylesheet animates it. Its child is one element, or one conditional of elements, and a leaving element stays in its place until its transition ends. Transitions compile to all seven targets, the server renders the settled child, and Astro renders the settled child only.

A child that isn't one element or one conditional of elements is UF3057, and a bound or empty `name` or a bound `appear` is UF3058.

`@unframework.dev/testing` now waits, as it settles a page before each capture, until no transition or animation runs, for at most 2 seconds. One still running then fails the test.

On Svelte and Solid, a directive with only an `unmounted` hook no longer imports `untrack` or reads its value, which their linters reported.
