---
"@unframework.dev/target-solid": minor
"@unframework.dev/target-solid2": minor
---

Solid and Solid 2 share their helpers in `_unframework/` (ADR-0121). A component, a composable and a directive module import `cx`, `styleProperties`, `scopeAttributes`, `modelText`, `selectOptions`, `nextTick`, `queueHook`, `KeyedFor` and `Transition` from their modules, and Solid also imports `Teleport`. Solid 2 also shares `createState`, `enumeratedValue` and `clearedRef`. A module that holds JSX is a `.tsx` file.

The watchers and their scheduler stay inline, as do `restAttributes`, `textCaret`, `toggle` and `selectedValues`. On Solid 2, `Teleport` stays inline, and so does the `createState` of a component with watchers, whose write queues their flush. A context without `helper` still gets every helper inline.
