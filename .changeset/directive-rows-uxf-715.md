---
"@unframework.dev/analyzer": minor
"@unframework.dev/codegen": minor
"@unframework.dev/ir": minor
"@unframework.dev/target-qwik": minor
"@unframework.dev/target-react": minor
---

Directives now work on each row a list renders, and in a scoped slot's fill, with a value that reads the row's item or the fill's props: `items.map((item) => <li key={item.id} v-tooltip={item.label}>…</li>)`. Each element runs its own hooks with its own value, on every target that runs directives. These two uses were UF1002 before.
