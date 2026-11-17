---
"@unframework.dev/target-solid2": minor
"@unframework.dev/cli": minor
"@unframework.dev/compiler": minor
"@unframework.dev/testing": minor
"@unframework.dev/unplugin": minor
"@unframework.dev/visual": minor
"@uxfront/unframework": minor
---

Add `solid@2`, a target for Solid 2. A project opts in with `targets: ["solid@2"]`: `solid` and `solid@1` still mean Solid 1, and the default targets stay the seven. Its output, tree and package subpath are named `solid2`.

A configuration, `compile()`, the bundler plugin and `unframework test`, `visual` and `preview` take a target's framework and major as well as its name, and a major that doesn't exist names `solid@2`. On Vite, the plugin tells Solid 1's plugin from Solid 2's by the `solid-js` the app installs. `build --package` writes a `./solid2` subpath compiled by Solid 2's compiler, and a package with both Solid targets takes either `solid-js` major as its peer.

A project that installs both Solid majors keeps Solid 2 in a directory of its own and points `package.resolveFrom.solid2` at it.
