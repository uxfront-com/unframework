---
"@uxfront/unframework": minor
"@unframework.dev/ir": minor
"@unframework.dev/analyzer": minor
"@unframework.dev/codegen": minor
"@unframework.dev/target-angular": minor
---

Render a default slot on Angular in each place where a component renders it more than once at a time: in each row of a list, in two places at once like a header and a footer, in both branches of a `<Transition>` while one leaves, or in a fill its child renders per row. Angular used to render the parent's content in one of those places only, and the others rendered the slot empty.

The analyser now marks such a slot `repeated`, on `SlotDeclaration` and on `ApiSlot`, so a parent in another file reads it too. On Angular, a `repeated` default slot is a directive the component's file exports, `<Component>Default` with the selector `ng-template[uf<Component>Default]`, as a scoped default slot is, and each place renders the template the parent passes.

`PrintedFill` and `PrintedSlotOutlet` take a `template` flag, which the Angular dialect reads. ADR-0126 records it. The other six targets' outputs don't change.

**Breaking:** a hand-written Angular consumer of a component whose default slot is `repeated` now passes its content in `<ng-template uf<Component>Default>`, and imports the directive, since children passed as they are render nothing. A component that renders its default slot one place at a time keeps `<ng-content>`.
