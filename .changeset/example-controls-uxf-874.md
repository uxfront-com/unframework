---
"@unframework.dev/visual": minor
"@unframework.dev/unplugin": minor
---

Add controls to an example in `unframework preview` and in a static preview. Selecting an example used to leave the controls panel empty, and now it shows a group for each component the example renders: a value reaches every instance that doesn't set the prop itself, so a colours example can toggle `disabled` and keep each button's colour. The preview rewrites the example for its own servers only, so `unframework visual` and the tests render it as written. It does so through the unframework plugin's new `transformSource` option, which gives the text to compile for a `.uf.tsx` or `.uf.ts` file in place of the one on disk.
