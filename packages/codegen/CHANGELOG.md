# @unframework.dev/codegen

## 0.1.3

### Patch Changes

- Updated dependencies [58736dd]
  - @unframework.dev/diagnostics@0.2.0

## 0.1.2

### Patch Changes

- 561e45f: Point the `homepage` link npm shows for each package at https://unframework.dev, the site and its docs, in place of the package's README on GitHub.
- Updated dependencies [561e45f]
  - @unframework.dev/diagnostics@0.1.1
  - @unframework.dev/ir@0.1.1
  - @unframework.dev/parser@0.1.1

## 0.1.1

### Patch Changes

- 51da760: Write a bound `value` beside a radio's or a checkbox group's `v-model` as `value={…}` on Svelte, so Svelte's server render marks the input whose value the model holds as `checked`, as every other target does. The object spread it used before, `{...{ value: … }}`, rendered no `checked` on the server.

## 0.1.0

### Minor Changes

- f47bb2d: First release. Unframework compiles one `.uf.tsx` component into native React, Vue, Svelte, Solid, Angular, Qwik and Astro components.

### Patch Changes

- Updated dependencies [f47bb2d]
  - @unframework.dev/diagnostics@0.1.0
  - @unframework.dev/ir@0.1.0
  - @unframework.dev/parser@0.1.0
