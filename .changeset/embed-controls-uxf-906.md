---
"@unframework.dev/visual": minor
---

Let an embedded example show its controls, take a colour mode and report its height. `embed.html` takes three optional parameters, and any other value shows a message that names the values it takes. Without them, an embed is unchanged.

`controls=true` shows the example's controls below it, with the preview's props rule, and keeps their styles apart from the project's. `theme=light` or `theme=dark` sets `data-theme` and `color-scheme` on the embed's page before it renders, and the page that frames it can change the mode with `{ type: "unframework:embed", kind: "theme", theme }`. `resize=true` posts `{ type: "unframework:embed", kind: "resize", height }` to that page whenever the content's height changes, so it can size the `<iframe>`.
