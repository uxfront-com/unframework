---
"@unframework.dev/visual": minor
"@unframework.dev/unplugin": minor
---

Add controls to an example in `unframework preview` and in a static preview. Selecting an example used to leave the controls panel empty. Now it shows a group for each component the example renders, and a value reaches every instance of that component that doesn't set the prop itself, so a colours example can toggle `disabled` and keep each button's colour. A prop every instance sets is listed as "Set by the example". The preview rewrites the example for its own servers only, so `unframework visual` and the tests render it as written. The unframework plugin gains the `transformSource` option this uses, which gives the text to compile for a `.uf.tsx` or `.uf.ts` file in place of the one on disk.
