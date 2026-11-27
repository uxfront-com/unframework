---
"@uxfront/unframework": patch
"@unframework.dev/target-angular": patch
---

Render a default slot on Angular in whichever place renders it, where its places render one at a time. A default slot under a conditional, a teleport, a transition or another slot's fallback inside a `<component is>`, or one in both branches of a conditional, like `{href ? <b>{slots.default?.()}</b> : <i>{slots.default?.()}</i>}`, used to render the parent's content in one place only, and the other places rendered the slot empty, without its fallback.

Angular projects a parent's content into one `<ng-content>` only, so the template now declares it once, before the `@switch` or the `@if` that holds every place, and each place renders it with `ngTemplateOutlet`. A place whose fallback reads a name its conditional narrows keeps that fallback where it is, in an `<ng-template>` it passes on.

ADR-0125 records it. The other six targets' outputs don't change, and a default slot under a list still renders in one place only on Angular.
