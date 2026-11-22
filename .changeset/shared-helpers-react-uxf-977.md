---
"@unframework.dev/codegen": minor
"@unframework.dev/compiler": minor
"@unframework.dev/cli": minor
"@unframework.dev/unplugin": minor
"@unframework.dev/target-react": minor
"@unframework.dev/diagnostics": minor
---

Helpers live in shared modules (ADR-0121). A target puts each helper it emits for a missing primitive through `EmitContext.helper` into one module per helper, `_unframework/<file>` at the root of the output tree, which every output imports. React shares its helpers this way, so a tree holds each once. `compile()` now returns the helper modules beside the components, lists their paths in `CompileResult.helpers`, and takes a `helperRoot` option. A caller that writes only the component files must write the helper modules too. The CLI writes each once per tree, `--package` carries them, and the unplugin loads each from one virtual id per graph, with a `helperRoot` option. UF1104 also covers a shared module that would take a helper module's place.
