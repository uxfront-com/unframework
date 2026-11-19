---
"@unframework.dev/visual": minor
"@unframework.dev/diagnostics": patch
---

Centre examples in the preview, and add an `@layout` tag. `unframework preview` and `preview build` now centre every example and component in its frame, with `1rem` of padding, so a small component no longer sits in a corner. This moves every existing example.

`@layout` in an example's doc comment changes how it sits, the way `display: flex` would: `row` or `column`, `justify-*`, `align-*`, `wrap` and a gap, like `@layout column align-start gap`. The gap comes from a scale, `gap-xs`, `gap-sm`, `gap`, `gap-lg` and `gap-xl` (`0.25rem` to `2rem`), or as a length like `gap-12px`.

`@layout none` gives the old full-width block back, without padding. `Example` gains `layout`, and a malformed value is UF7012, whose description now covers it. `unframework visual` doesn't read the tag, so captures and baselines stay the same.
