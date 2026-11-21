---
"@uxfront/unframework": minor
"@unframework.dev/ir": minor
"@unframework.dev/analyzer": minor
"@unframework.dev/codegen": minor
"@unframework.dev/diagnostics": minor
"@unframework.dev/target-react": minor
"@unframework.dev/target-svelte": minor
"@unframework.dev/target-solid": minor
"@unframework.dev/target-solid2": minor
"@unframework.dev/target-angular": minor
"@unframework.dev/target-qwik": minor
"@unframework.dev/target-astro": minor
---

Let a `<component is>` over tags be a component's root that a parent styles. A parent's `class` and `style` now merge into whichever tag renders, as into a one-element root, and so does a styled parent's scope attribute. An attribute that only some of the tags take, like `href` on `is={href ? "a" : "button"}`, is accepted and renders only on those tags, where it used to be UF3006. So one component can render a link or a button with one styled root.

`ComponentApi.root` has a new value, `"dynamic"`, with the tags in `ComponentApi.rootTags`. `ComponentApi.rootUnlisted` marks a `<component is>` root whose tags the API can't read, and `DynamicNode.only` lists the attributes only some tags take. Code that switches on every value of `ComponentApi.root` must handle `"dynamic"`. React also compiles a listener on a `<component is>` over tags, which failed to emit before.
