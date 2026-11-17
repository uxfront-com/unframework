# @unframework.dev/cli

## 0.1.5

### Patch Changes

- Updated dependencies [58736dd]
  - @unframework.dev/diagnostics@0.2.0
  - @unframework.dev/compiler@0.2.3

## 0.1.4

### Patch Changes

- 561e45f: Point the `homepage` link npm shows for each package at https://unframework.dev, the site and its docs, in place of the package's README on GitHub.
- Updated dependencies [561e45f]
  - @unframework.dev/compiler@0.2.2
  - @unframework.dev/diagnostics@0.1.1
  - @unframework.dev/parser@0.1.1
  - @unframework.dev/type-oracle-tsgo@0.1.2

## 0.1.3

### Patch Changes

- 6b7c023: Keep `unframework build --package` working on TypeScript 7.1 for React and Solid. Declarations are named `Card.d.ts` again, not `Card.d.d.ts`, and UF7009 carries tsgo's declaration error again, which 7.1 builds used to pass silently. On TypeScript 7.1, install tsdown `0.23.7` or later.
- Updated dependencies [6b7c023]
  - @unframework.dev/type-oracle-tsgo@0.1.1

## 0.1.2

### Patch Changes

- @unframework.dev/compiler@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [fc310cc]
  - @unframework.dev/compiler@0.2.0

## 0.1.0

### Minor Changes

- f47bb2d: First release. Unframework compiles one `.uf.tsx` component into native React, Vue, Svelte, Solid, Angular, Qwik and Astro components.

### Patch Changes

- Updated dependencies [f47bb2d]
  - @unframework.dev/compiler@0.1.0
  - @unframework.dev/diagnostics@0.1.0
  - @unframework.dev/parser@0.1.0
  - @unframework.dev/type-oracle-tsgo@0.1.0
