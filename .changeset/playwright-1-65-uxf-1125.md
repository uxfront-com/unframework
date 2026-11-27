---
"@unframework.dev/testing": patch
"@unframework.dev/visual": patch
---

Update `axe-core` to 4.14.1. `BASELINE_ENVIRONMENT` is now `mcr.microsoft.com/playwright:v1.65.1-noble linux/amd64`, the image of Playwright 1.65.1, so only a run in that image writes the committed visual baselines.

The preview's example and component trees name each group from its row alone, without `aria-labelledby`. axe-core 4.14.1 runs `label-content-name-mismatch` by default, and that rule failed a group item whose name left out the text of its nested items.
