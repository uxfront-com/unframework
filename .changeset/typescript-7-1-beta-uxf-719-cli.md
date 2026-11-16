---
"@unframework.dev/cli": patch
---

Keep `unframework build --package` working on TypeScript 7.1 for React and Solid. Declarations are named `Card.d.ts` again, not `Card.d.d.ts`, and UF7009 carries tsgo's declaration error again, which 7.1 builds used to pass silently. On TypeScript 7.1, install tsdown `0.23.7` or later.
