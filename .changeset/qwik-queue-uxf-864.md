---
"@unframework.dev/unplugin": patch
---

Serve a module's children without waiting on other files' compiles. When a module loads, the plugin now also compiles the `.uf.tsx` and `.uf.ts` files it imports, and theirs, so they are ready before anything requests them. A request for a file whose compile is still current no longer waits behind the compiles of unrelated files. On a busy dev server, Qwik's first render of a component with children took tens of seconds, because each of its segments waited in that line to resolve its imports.
