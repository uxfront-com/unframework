---
"@unframework.dev/target-qwik": minor
---

Qwik's helpers now live once per output tree, in generated modules in `_unframework/`, which each output imports by a relative path (ADR-0121): `scopeAttributes`, `styleObject`, `nextTick`, `modelText`, `queueHook`, `teleport` and the transition set. A caller of `emit()` that passes `EmitContext.helper` must write the helper modules too. Without it, the helpers stay inline, as before.
