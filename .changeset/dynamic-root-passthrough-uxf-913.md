---
"@uxfront/unframework": minor
"@unframework.dev/ir": minor
"@unframework.dev/diagnostics": minor
"@unframework.dev/analyzer": minor
"@unframework.dev/target-react": minor
"@unframework.dev/target-vue": minor
"@unframework.dev/target-svelte": minor
"@unframework.dev/target-solid": minor
"@unframework.dev/target-solid2": minor
"@unframework.dev/target-angular": minor
"@unframework.dev/target-qwik": minor
"@unframework.dev/target-astro": minor
---

Pass a consumer's attributes, listeners and ref through to a component whose root is a `<component is>` over tags, on whichever tag renders. An attribute that every tag takes, like `id`, `title`, `aria-*` or `data-*`, and a DOM listener now land on the element that renders, where they used to be UF1002: `<Button href="#docs" id="docs" aria-describedby="hint" onClick={track} />`. An attribute that only some tags take is still UF1002, as `disabled` is on `<component is={href ? "a" : "button"}>`, since `<a>` doesn't take it: declare it as a prop and set it on the `<component is>`. A `ref` on such a component holds the element that renders, typed as the union of the tags' elements: `useTemplateRef<HTMLAnchorElement | HTMLButtonElement>()`.

`ComponentApi` has a new field, `refTags`, the tags a ref may hold. Each target writes the rest its own way, which ADR-0122 records.

On Angular, an element with a static attribute holding `{{` is printed where Angular binds nothing, so a child whose root is one takes nothing that falls through. A parent that passes it an attribute, a listener, `class` or `style` now gets UF1002 on Angular, where the Angular output used to drop it.
