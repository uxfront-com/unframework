# @unframework.dev/type-oracle-tsgo

## 0.1.1

### Patch Changes

- 6b7c023: Run `createTsgoOracle` on TypeScript `7.1.0-beta`, through its `typescript/sync` API, since `typescript/unstable/sync` is gone in 7.1. It gives the same shapes as on 7.0.2, and its `typescript` dependency is now `7.1.0-beta`, until 7.1.0 is published.

## 0.1.0

### Minor Changes

- f47bb2d: First release. Unframework compiles one `.uf.tsx` component into native React, Vue, Svelte, Solid, Angular, Qwik and Astro components.

### Patch Changes

- Updated dependencies [f47bb2d]
  - @unframework.dev/type-oracle@0.1.0
