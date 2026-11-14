---
"@unframework.dev/analyzer": minor
"@unframework.dev/cli": minor
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

Add `<Teleport to>`, which mounts one element at the end of another part of the page once the component has mounted, like a dialog or a toast. It compiles to all seven targets, and Astro renders nothing for it. The server renders none of it, and it unmounts with its component. A bound or empty `to` is UF3053, and content other than one element is UF3054.

React packages now peer on `react-dom`, whose `createPortal` a `<Teleport>` needs.

`@unframework.dev/testing` now captures what a view appends to `<body>`: the DOM, ARIA, geometry, screenshot and axe checks cover it after the view's container, and the view's queries reach what it holds. A test that leaves an element in `<body>` once its views are unmounted now fails, naming the element.
