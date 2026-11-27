---
"@unframework.dev/target-astro": patch
---

Start the render server when Vitest configures an Astro browser project, before any test runs. A host outside Vitest, like the preview, still starts it on the first render.

The server used to start on the first render, so the first test of each spec file waited for it. In a busy run, that start took up to 75 seconds, and those tests timed out.
