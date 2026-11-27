---
"@uxfront/unframework": patch
"@unframework.dev/target-angular": patch
---

Render a default slot in every case of a `<component is>` on Angular. A component like `<component is={href ? "a" : "button"}>{slots.default?.() ?? label}</component>` used to render the parent's content in one tag only, and the other tags rendered the slot empty, without its fallback.

Angular projects a parent's content into one `<ng-content>` only, so the template now declares the slot once, in an `<ng-template>` before its `@switch`, and each `@case` renders it with `ngTemplateOutlet`.

ADR-0124 records it. The other six targets' outputs don't change.
