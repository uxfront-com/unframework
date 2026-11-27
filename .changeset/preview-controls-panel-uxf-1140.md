---
"@unframework.dev/visual": minor
---

Show what changed in the preview's controls panel, and put it back in one click. The panel is the same in `unframework preview`, a static preview build and an embed with `controls=true`.

- A control that left its first value shows a dot, and its name reads "(changed)". Each group shows how many of its controls changed, with a **Reset** button, and the panel's status line shows the count for all of them, with **Reset all**.
- The unset choice reads "Default", and an optional text or number field shows "Default" as its placeholder.
- An optional boolean, or a union with at most 4 choices of at most 24 characters together, is a row of segments: one click, one Tab stop, and the arrow keys move the choice. A longer union stays a list, and a required boolean stays a checkbox.
- Each prop's name sits above its field at the panel's full width, and breaks only at its camelCase humps. Its type is on the right. When two groups have the same name, each shows its path on a row of its own.
- Each group folds, and its "Set by the example" and "Not controllable" lists sit in one closed disclosure that gives their counts. A prop the preview can't set gets a short reason, like "an object", then its type.
