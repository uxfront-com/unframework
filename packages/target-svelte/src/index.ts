import { defineTarget, printMarkup, svelteDialect } from "@unframework/codegen";
import type { MarkupDialect } from "@unframework/codegen";
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
    "style-binding": {
      support: "emulated",
      helper: "styleText",
      note: "Svelte's `style` takes a declaration list, so a style bound to an object goes through an inline helper, `styleText`, that writes its declarations (ADR-0065); declarations print as `style:` directives.",
    },
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
    fallthrough: {
      support: "emulated",
      helper: "mergeStyle",
      note: "A component takes a consumer's `style` as a string, merged over its root's own declarations through an inline helper, `mergeStyle`, where a consumer's nullish value removes the root's declaration, as an object merge does (ADR-0054).",
    },
    "contextual-root": { support: "native" },
    expose: { support: "native" },
    context: { support: "native" },
    "reactive-context": {
      support: "emulated",
      helper: "refObject",
      note: "A provided ref is passed as an object with a `value` getter, `refObject`, which descendants read as it changes (ADR-0054).",
    },
    "dynamic-component": { support: "native" },
    "scoped-styles": { support: "native" },
    // The child's root picks its styled parents' `data-uf-*` props out of `$props()` (ADR-0063):
    // their names are the parents', which the child cannot know.
    "child-root-scope": {
      support: "emulated",
      helper: "scopeAttributes",
      note: "A child cannot know the scope attributes its styled parents pass, so an inline helper picks them out of its props by name and spreads them on its root, on each branch of a root conditional and on a root <component is> too, as Vue's fallthrough reaches them.",
    },
    "slotted-styles": { support: "native" },
    // A sheet loads as its module evaluates, in import order, as Vue's does (ADR-0063).
    "sheet-order": { support: "native" },
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
    const script = instanceScript(component, context.module);
    const { module, block, markup: options, render } = script;
    // The component resolves the names of loop variables and setup bindings.
    const { styleText } = script;
    // A style bound to one value is the declaration list `styleText` writes (ADR-0065).
    const dialect: MarkupDialect = styleText
      ? {
          ...svelteDialect,
          styleAttribute: (parts, attributeContext) =>
            parts[0]?.property === ""
              ? [{ name: "style", text: `style={${styleText}(${parts[0].value})}` }]
              : svelteDialect.styleAttribute(parts, attributeContext),
        }
      : svelteDialect;
    const markup = printMarkup(render, dialect, {
      component: script.component,
      module: context.module,
      ...options,
    });
    const parts = [OPTIONS, ...(module ? [module] : []), ...(block ? [block] : []), markup];
    return [{ path: `${component.name}.svelte`, contents: `${parts.join("\n\n")}\n` }];
  },
});

export default svelte;
