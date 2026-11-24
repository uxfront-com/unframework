# @unframework.dev/target-solid2

## 0.2.0

### Minor Changes

- 348db69: Let a `<component is>` over tags be a component's root that a parent styles. A parent's `class` and `style` now merge into whichever tag renders, as into a one-element root, and so does a styled parent's scope attribute. An attribute that only some of the tags take, like `href` on `is={href ? "a" : "button"}`, is accepted and renders only on those tags, where it used to be UF3006. So one component can render a link or a button with one styled root.

  `ComponentApi.root` has a new value, `"dynamic"`, with the tags in `ComponentApi.rootTags`. `ComponentApi.rootUnlisted` marks a `<component is>` root whose tags the API can't read, and `DynamicNode.only` lists the attributes only some tags take. Code that switches on every value of `ComponentApi.root` must handle `"dynamic"`. React also compiles a listener on a `<component is>` over tags, which failed to emit before.

### Patch Changes

- Updated dependencies [348db69]
  - @unframework.dev/ir@0.3.0
  - @unframework.dev/codegen@0.3.0

## 0.1.1

### Patch Changes

- @unframework.dev/codegen@0.2.1

## 0.1.0

### Minor Changes

- de1d9d0: Add `solid@2`, a target for Solid 2. A project opts in with `targets: ["solid@2"]`: `solid` and `solid@1` still mean Solid 1, and the default targets stay the seven. Its output, tree and package subpath are named `solid2`.

  A configuration, `compile()`, the bundler plugin and `unframework test`, `visual` and `preview` take a target's framework and major as well as its name, and a major that doesn't exist names `solid@2`. On Vite, the plugin tells Solid 1's plugin from Solid 2's by the `solid-js` the app installs. `build --package` writes a `./solid2` subpath compiled by Solid 2's compiler, and a package with both Solid targets takes either `solid-js` major as its peer.

  A project that installs both Solid majors keeps Solid 2 in a directory of its own and points `package.resolveFrom.solid2` at it.

### Patch Changes

- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
- Updated dependencies [de1d9d0]
  - @unframework.dev/codegen@0.2.0
  - @unframework.dev/ir@0.2.0
