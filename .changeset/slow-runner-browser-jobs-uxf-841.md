---
"@unframework.dev/testing": patch
---

`view.expectThrown` now tells a failed action from a component that threw. When the step's action fails, like a click that times out on an element that never becomes actionable, the test fails with the action's own error, and L14 reports that the action failed. Before, L14 mapped that error's stack as if the component had thrown it, and blamed the source map.
