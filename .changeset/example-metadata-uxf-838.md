---
"@unframework.dev/visual": minor
---

Add example metadata. A doc comment on an example's default export now gives `unframework preview` its description, and `@category`, `@title` and `@order` set where the preview lists it, under what name and in what order. Without a comment, an example takes its category from its directory and its title from its file name, so `src/components/button/examples/ButtonColors` is `Colors` in `Button`. `Example` gains `category`, `title`, `description` and `order`, `Preview` gains `diagnostics`, and a malformed tag is the new warning UF7012, which the preview prints and then ignores. `unframework visual` doesn't read the comment, so ids, baselines and reports stay the same. Code that builds an `Example` by hand must now set `category` and `title`.
