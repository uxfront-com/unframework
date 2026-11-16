---
"@unframework.dev/analyzer": minor
"@unframework.dev/compiler": minor
"@unframework.dev/diagnostics": minor
"@unframework.dev/type-oracle": minor
"@unframework.dev/type-oracle-tsgo": minor
---

Check a directive's value against its type under the tsgo type oracle. TypeScript doesn't type a dashed JSX attribute, so `v-focus-trap={1}` type-checks where `vFocusTrap` takes `boolean`. With `typeOracle: "tsgo"`, the compiler now types each value where it is written, narrowed by its branch, and reports one of another type as UF6007, `directive-value-type`.

A static string, `v-tone="warn"`, is checked by its text. The default syntactic oracle checks no value.

`TypeOracle` gains an optional `checkDirectiveValues` query, which the tsgo adapter answers in one call per module. `createTsgoOracle` takes two new options: `include`, the files its checker's project holds, and `readFile`, how its syntactic layer reads a file.
