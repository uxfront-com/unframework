# @unframework.dev/type-oracle

## 0.2.0

### Minor Changes

- de1d9d0: Check a directive's value against its type under the tsgo type oracle. TypeScript doesn't type a dashed JSX attribute, so `v-focus-trap={1}` type-checks where `vFocusTrap` takes `boolean`. With `typeOracle: "tsgo"`, the compiler now types each value where it is written, narrowed by its branch, and reports one of another type as UF6007, `directive-value-type`.

  The value takes the directive's type as its context, as in an assignment, so a template literal or a generic call is typed as the directive needs. The default syntactic oracle checks no value.

  `TypeOracle` gains an optional `checkDirectiveValues` query, which the tsgo adapter answers in one call per module from the source the caller compiles. `createTsgoOracle` takes two new options: `include`, the files its checker's project holds, and `readFile`, how its syntactic layer reads a file.

## 0.1.1

### Patch Changes

- 561e45f: Point the `homepage` link npm shows for each package at https://unframework.dev, the site and its docs, in place of the package's README on GitHub.

## 0.1.0

### Minor Changes

- f47bb2d: First release. Unframework compiles one `.uf.tsx` component into native React, Vue, Svelte, Solid, Angular, Qwik and Astro components.
