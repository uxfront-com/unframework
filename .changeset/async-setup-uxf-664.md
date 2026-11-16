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

Add async setup: a component may be `async` and declare what it waits for as `const user = await loadUser(id)` at the top of its setup. The server renders what it loaded, a client mount renders once the setup resolves, and a hydrated page keeps the server's HTML while the setup runs again. Async components compile to all seven targets, and the JSX types accept one as a tag.

An `await` that isn't the whole value of a top-level `const` is UF2038, and an `await` after another setup item, or one that reads more than props, module values and earlier awaits, is UF2039. An async component as a `<component is>` candidate is UF1002 for now.

Two hosts do one thing each: a hand-written Vue parent wraps an async component in `<Suspense>`, and a Svelte app sets `compilerOptions.experimental.async` for the files that await. On Svelte, a `provide` that reads an awaited value is UF1002.

`@unframework.dev/testing`'s hydrate projects now give the focus back to the hydrated view after the client render they compare it with, so a component that focuses as it mounts keeps the focus.
