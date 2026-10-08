import { compositionUse, defineTarget, printMarkup, svelteDialect } from "@unframework/codegen";
import type { EmitContext, OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

import { instanceScript } from "./script.ts";

/**
 * The options every component declares, so that it compiles the same whatever the consumer's
 * configuration. Runes mode: Svelte infers it from rune usage, so a component without runes
 * would otherwise compile in legacy mode. `preserveWhitespace={false}`, Svelte's default, which
 * the markup's layout is printed for (`svelteDialect`): with a consumer's
 * `preserveWhitespace: true`, the indentation would become text.
 */
const OPTIONS = "<svelte:options runes={true} preserveWhitespace={false} />";

/**
 * The Svelte 5 target: runes-mode components. A component is its options, its instance script
 * when it takes props or has a setup (`script.ts`), and its markup, printed in `svelteDialect`
 * (plan §6).
 */
export const svelte: Target = defineTarget({
  name: "svelte",
  framework: { package: "svelte", range: ">=5.57 <6" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    listbox: { support: "native" },
    interactivity: { support: "native" },
    props: { support: "native" },
    interpolation: { support: "native" },
    conditional: { support: "native" },
    list: { support: "native" },
    fragment: { support: "native" },
    "bound-attribute": { support: "native" },
    "class-binding": { support: "native" },
    "style-binding": { support: "native" },
    "attribute-spread": { support: "native" },
    svg: { support: "native" },
    component: { support: "native" },
    "component-event": { support: "native" },
    "default-slot": { support: "native" },
    "named-slot": { support: "native" },
    "scoped-slot": { support: "native" },
    "slot-fallback": { support: "native" },
    "default-slot-presence": { support: "native" },
    "slot-forwarding": { support: "native" },
    model: { support: "native" },
    "two-way-binding": { support: "native" },
    "model-array": { support: "native" },
    "model-modifiers": {
      support: "emulated",
      helper: "modelText",
      note: "A `v-model`'s modifiers and a number control's cast follow Vue's `vModelText` through an inline helper, `modelText` (ADR-0054).",
    },
    fallthrough: { support: "native" },
    "contextual-root": { support: "native" },
    expose: { support: "native" },
    context: { support: "native" },
    "reactive-context": {
      support: "emulated",
      helper: "refObject",
      note: "A provided ref is passed as an object with a `value` getter, `refObject`, which descendants read as it changes (ADR-0054).",
    },
    "dynamic-component": { support: "native" },
    // A capture listener is an attribute, `onclickcapture` (ADR-0047).
    "event-capture": { support: "native" },
    // `once` and `passive` listen through `on` from `svelte/events`, in an attachment (`events.ts`):
    // `passive` with `addEventListener`'s own option, `once` through a guard (`script.ts`).
    "event-once": {
      support: "emulated",
      helper: "once",
      note: "A once listener's handler goes through `once`, a wrapper whose guard is set when the handler first runs, never `{ once: true }`: `on` runs the handlers Svelte delegated below its element inside its own listener, so the option would be used up by an event one of them stopped.",
    },
    "event-passive": { support: "native" },
    // Svelte's listeners are the DOM's, delegated for some events with the propagation kept;
    // the events its attributes make passive listen through `on` (`events.ts`).
    "event-semantics": { support: "native" },
    // A control runs where the handler calls it, while the event is dispatched.
    "conditional-event-control": { support: "native" },
    // `$props.id()`, once per component, every further id derived from it (`script.ts`).
    "use-id": { support: "native" },
    // `tick` from `svelte`.
    "next-tick": { support: "native" },
    // `$props()` is reactive whatever keys a parent passes.
    "late-prop": { support: "native" },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    // Composition's cells are declared before this target emits it (ADR-0055): until M3's lane
    // for Svelte lands, a component that uses it is reported, never emitted without it (P2).
    const composition = compositionUse(context.module, component);
    if (composition) {
      context.report({
        code: "UF1002",
        severity: "error",
        message: `The svelte target does not emit ${composition.what} yet: composition lands in M3.`,
        span: composition.span,
      });
      return [];
    }
    const { block, markup: options } = instanceScript(component, context.module);
    // The component resolves the names of loop variables and setup bindings.
    const markup = printMarkup(component.render, svelteDialect, { component, ...options });
    const parts = block === undefined ? [OPTIONS, markup] : [OPTIONS, block, markup];
    return [{ path: `${component.name}.svelte`, contents: `${parts.join("\n\n")}\n` }];
  },
});

export default svelte;
