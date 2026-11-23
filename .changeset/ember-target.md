---
"@unframework.dev/compiler": minor
"@unframework.dev/codegen": minor
"@unframework.dev/unplugin": minor
"@unframework.dev/testing": minor
"@unframework.dev/cli": minor
---

Add `ember`, an opt-in target that compiles a component to an Ember 7.4 `.gts` file: a template-only component, or a `@glimmer/component` class whose members hold what the template cannot. It emits every capability; the ones Ember has no feature for go through inline helpers, and `late-prop` is unsupported by design, as a warning. Directives and composables compile to `.ts` modules beside the components. The default targets stay the seven. `build --package` packages `ember` as a v2 addon with Glint's declarations. A component with no output for a target no longer takes its scoped sheet there.
