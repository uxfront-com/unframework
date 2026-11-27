---
"@unframework.dev/testing": patch
---

Update `axe-core` to 4.14.1. `BASELINE_ENVIRONMENT` is now `mcr.microsoft.com/playwright:v1.65.1-noble linux/amd64`, the image of Playwright 1.65.1, so only a run in that image writes the committed visual baselines.
