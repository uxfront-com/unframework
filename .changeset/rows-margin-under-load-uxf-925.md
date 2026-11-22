---
"@unframework.dev/testing": patch
---

Run the hydrate projects after the browser followers in a live Chromium run. Every page project's browser commands go through Vitest's main process, so the eight hydrate projects beside the followers slowed their screenshots, clicks and ARIA snapshots: in a loaded full run, a follower's 10-scenario test took 30 to 33 seconds of its 60-second timeout, and 13 seconds once the hydrate projects ran after it. The full run got shorter too. Update runs, CI's baseline mode, Firefox and WebKit keep their groups.
