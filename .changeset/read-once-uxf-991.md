---
"@unframework.dev/compiler": patch
---

Read each file once while a compile, an update, a `resolve()` or a `resolve.cycle()` is in flight. A project read a file again for every path that reached it: as a child, in each import cycle search and in the compile itself, so a page with five imports in cycles read some files seven times. Each file's text is now kept until the work in flight ends, so `readFile` runs once per file, a slow disk costs one wait per file, and one compile sees one version of each file. The next compile or update reads the files again.
