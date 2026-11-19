---
"@unframework.dev/visual": minor
---

Open an example by its own URL, so another page can show it in an `<iframe>`. `embed.html?example=<id>&target=<target>`, beside the preview's page in a static site from `unframework preview build` and on the dev preview's server, shows that example alone on that target, with no sidebar, canvas or controls. It takes no messages from the page that frames it, and an unknown or missing example or target shows a message instead of a blank page. Each frame's caption in the preview now has an **Open** link to the selected example's URL on that target.
