import { defineTarget, printMarkup, svelteDialect } from "@unframework.dev/codegen";
import type { MarkupDialect } from "@unframework.dev/codegen";
import type { EmitContext, OutputFile, Target } from "@unframework.dev/codegen";
import type { ElementNode, UfComponent, UfComposable } from "@unframework.dev/ir";

import { emitDirective } from "./directive.ts";
import { SVELTE_EVENT_INTERFACES } from "./events.ts";
import { composableModule, instanceScript, lateProvides } from "./script.ts";
import { sharedHelper } from "./shared.ts";

/** Whether a tag is a component's, which Svelte reads from a capitalised tag or one with a dot. */
const isComponentTag = (tag: string) => /^[A-Z]/.test(tag) || tag.includes(".");

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
      note: "Svelte's `style` takes a declaration list, so a style bound to an object goes through a shared helper, `styleText`, that writes its declarations (ADR-0065); declarations print as `style:` directives.",
    },
    "attribute-spread": { support: "native" },
    "raw-html": { support: "native" },
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
      note: "A `v-model`'s modifiers and a number control's cast follow Vue's `vModelText` through a shared helper, `modelText` (ADR-0054).",
    },
    // What a component does not declare is its props' rest, which its fallthrough element spreads
    // last (ADR-0118); only a style merges through a helper.
    fallthrough: {
      support: "emulated",
      helper: "mergeStyle",
      note: "A component takes a consumer's `style` as a string, merged over its root's own declarations through a shared helper, `mergeStyle`, where a consumer's nullish value removes the root's declaration, as an object merge does (ADR-0054). The attributes and listeners it does not declare are its props' rest, natively: its props type declares its root element's attributes from `svelte/elements` but for its own names, and the root, or the element that spreads the source's `...rest`, spreads the rest last, so the consumer's attribute wins; where that element listens to an event itself, its handler calls the consumer's listener after its own code (ADR-0118).",
    },
    "contextual-root": { support: "native" },
    // `bind:this` holds what a child exports, and on a child that exposes nothing its `ref` prop,
    // `$bindable`, which its root binds: the parent binds it, `bind:ref={save}` (ADR-0118).
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
      note: "A child cannot know the scope attributes its styled parents pass, so a shared helper picks them out of its props by name and spreads them on its root, on each branch of a root conditional and on a root <component is> too, as Vue's fallthrough reaches them. A root that spreads the props' rest takes them with it; where the source's `...rest` is another element's, the root picks them out of it, and that element spreads the rest without them, through a second helper, `restAttributes` (ADR-0118).",
    },
    "slotted-styles": { support: "native" },
    // A sheet loads as its module evaluates, in import order, as Vue's does (ADR-0063).
    "sheet-order": { support: "native" },
    "generic-components": { support: "native" },
    "generic-slot-props": { support: "native" },
    composables: { support: "native" },
    "composable-effect-order": { support: "native" },
    hydration: { support: "native" },
    "keyed-identity": { support: "native" },
    // Svelte has no portal (ADR-0098).
    teleport: {
      support: "emulated",
      helper: "teleport",
      note: "Svelte has no portal, so a `<Teleport>`'s element renders once the component has mounted, in an `{#if}` of its own, and an attachment, `teleport`, moves it into `to` and removes it on teardown (ADR-0098).",
    },
    // Svelte's `transition:` runs its own CSS, never Vue's classes (ADR-0100).
    transition: {
      support: "emulated",
      helper: "enter",
      note: "Svelte's transitions run their own CSS or ticks, never Vue's classes, so each element of a `<Transition>`'s conditional takes `in:enter` and `out:leave`, shared in the tree's `_unframework/transition.ts`, whose functions run the classes and return the transition's time as their `duration`. With `appear`, `in:` is global, so the enter runs as the element first mounts too (ADR-0100).",
    },
    // An attachment, `{@attach vFocusTrap(() => open)}` (ADR-0099).
    directive: { support: "native" },
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
    // Top-level `await` in the instance script, under Svelte's `experimental.async` compiler
    // option, which the host sets (ADR-0101).
    "async-setup": { support: "native" },
  },
  emit(component: UfComponent, context: EmitContext): Array<OutputFile> {
    // `setContext` after an await throws `set_context_after_init`, and a `provide` that reads what
    // the awaits or a later item set cannot move above them (ADR-0101).
    const late = lateProvides(component);
    for (const item of late) {
      context.report({
        code: "UF1002",
        severity: "error",
        message:
          "The svelte target does not provide a value that reads an awaited value or a later setup item yet: Svelte sets a context only before a component's first await. Provide a value that reads only props and module values, or provide it from a component that does not await.",
        span: item.span,
      });
    }
    if (late.length) {
      return [];
    }
    // With `helper`, the helpers are shared modules (ADR-0121); without it, inline as before.
    const script = instanceScript(
      component,
      context.module,
      context.helper && sharedHelper(context.helper, `${component.name}.svelte`),
    );
    const { module, block, markup: options, render } = script;
    // The component resolves the names of loop variables and setup bindings.
    const { styleText, teleport, transition, fallthrough } = script;
    const dialect: MarkupDialect = {
      ...svelteDialect,
      // An element with the props' rest is spread, as the root that spreads it: Svelte's server
      // renders its attributes through its runtime, which the static values' form must follow.
      attribute: (name, value, tag, where) =>
        svelteDialect.attribute(
          name,
          value,
          tag,
          where && where.element.attributes.some((attribute) => attribute.kind === "Rest")
            ? { ...where, spreads: true }
            : where,
        ),
      // The fallthrough element's own listener, which calls the consumer's too (ADR-0118), and a
      // listener passed to a component of an event Svelte's element types declare no attribute
      // for, in an object spread svelte-check does not check, as an element's attribute is
      // (`DECLARED_ONLY_ON`): the child's spread listens to it all the same.
      eventAttribute: (event, attributeContext) => {
        const composed = fallthrough.listeners.get(event.attribute);
        if (composed !== undefined) {
          return [{ name: `on${event.attribute.event}`, text: composed }];
        }
        const name = `on${event.attribute.event}`;
        if (
          isComponentTag(attributeContext.element.tag) &&
          SVELTE_EVENT_INTERFACES.get(event.attribute.event) === undefined
        ) {
          return [{ name, text: `{...{ ${name}: ${event.statement ?? event.handler} }}` }];
        }
        return svelteDialect.eventAttribute(event, attributeContext);
      },
      // A ref on a child that exposes nothing binds its `ref` prop, and the root's own ref sets
      // the component's `ref` prop too (ADR-0118).
      refAttribute: (ref, attributeContext) => {
        const text = fallthrough.refs.get(ref.attribute);
        return text === undefined
          ? svelteDialect.refAttribute(ref, attributeContext)
          : [{ name: "bind:this", text }];
      },
      // The props' rest, last on its element, so the consumer's attribute wins (ADR-0118).
      ...(fallthrough.rest === undefined
        ? {}
        : { restAttribute: () => [{ name: "", text: `{...${fallthrough.rest}}` }] }),
      // A style bound to one value is the declaration list `styleText` writes (ADR-0065).
      ...(styleText
        ? {
            styleAttribute: (parts, attributeContext) =>
              parts[0]?.property === ""
                ? [{ name: "style", text: `style={${styleText}(${parts[0].value})}` }]
                : svelteDialect.styleAttribute(parts, attributeContext),
          }
        : {}),
      // `{#if mounted}<div {@attach teleport("body")}>…</div>{/if}` (ADR-0098).
      ...(teleport
        ? {
            teleport: ({ node }) => [
              {
                kind: "block",
                segments: [
                  {
                    open: `{#if ${teleport.mounted}}`,
                    content: {
                      kind: "element",
                      element: node.children[0] as ElementNode,
                      directives: [
                        {
                          name: "@attach",
                          text: `{@attach ${teleport.helper}(${JSON.stringify(node.to)})}`,
                        },
                      ],
                    },
                  },
                ],
                close: "{/if}",
              },
            ],
          }
        : {}),
    };
    // `<p in:enter={"fade"} out:leave={"fade"}>` on each element of the conditional, and
    // `in:enter|global` for `appear` (ADR-0100).
    if (transition) {
      dialect.transitionAttributes = ({ node }) => {
        const name = `{${JSON.stringify(node.name)}}`;
        const conditional = node.children[0]?.kind === "If";
        return [
          ...((conditional || node.appear) && transition.enter !== undefined
            ? [
                {
                  name: "in:",
                  text: `in:${transition.enter}${node.appear ? "|global" : ""}=${name}`,
                },
              ]
            : []),
          ...(conditional && transition.leave !== undefined
            ? [{ name: "out:", text: `out:${transition.leave}=${name}` }]
            : []),
        ];
      };
    }
    const markup = printMarkup(render, dialect, {
      component: script.component,
      module: context.module,
      // An attachment reads its value through a getter, a closure (ADR-0099).
      closureDirectiveValues: true,
      ...options,
    });
    const parts = [OPTIONS, ...(module ? [module] : []), ...(block ? [block] : []), markup];
    return [{ path: `${component.name}.svelte`, contents: `${parts.join("\n\n")}\n` }];
  },
  emitDirective,
  // A composable is a `.svelte.ts` module, whose runes vite-plugin-svelte compiles (ADR-0069).
  emitComposable(composable: UfComposable, context: EmitContext): Array<OutputFile> {
    return [
      {
        path: `${composable.name}.svelte.ts`,
        contents: composableModule(composable, context.module),
      },
    ];
  },
});

export default svelte;
