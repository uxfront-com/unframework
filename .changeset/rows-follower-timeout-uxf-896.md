---
"@unframework.dev/testing": patch
---

Audit a capture's fonts with one round trip to the browser instead of one for each element. The L10 font audit now sends every element's request before it waits for an answer, so its time no longer grows with how busy the test run is. In a full local run, where every page project shares Vitest's main process, the audit's 430 requests for one 10-scenario test took about 20 seconds, and the test came close to its 60-second timeout. The audit checks the same elements and reports the same fonts as before.
