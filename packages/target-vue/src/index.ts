import { compositionUse, defineTarget, printMarkup, vueDialect } from "@unframework/codegen";
import type { EmitContext, OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

import { scriptSetup } from "./script.ts";

/**
 * The Vue 3.5 target, the reference (D10): single-file components. A component is its
 * `<script setup lang="ts">` (`script.ts`), when it has props, events, setup code or a listener
 * its template cannot hold, then its template, printed in `vueDialect` (plan §6): a setup
 * ref's value read as the ref, which Vue unwraps, and each listener as `listeners.ts` plans it.
 * A component with none of those is a template alone.
 */
export const vue: Target = defineTarget({
  name: "vue",
  framework: { package: "vue", range: ">=3.5 <4" },
  capabilities: {
    element: { support: "native" },
    text: { support: "native" },
    "static-attribute": { support: "native" },
    // Only Vue's client mount differs: its server render and stringified templates are right,
    // and no template avoids it (`:size` and `v-bind` are patched after the children too). The
    // client parity test fails once Vue sets `size` before the options: mark it native then.
    listbox: {
      support: "unsupported",
      code: "UF4001",
      severity: "error",
      reason:
        "runtime-dom's `nodeOps.createElement` sets `multiple` but not `size` before the options are inserted, so Vue's client selects the first option, as a drop-down does.",
    },
    // The source's Composition API is Vue's (ADR-0045 to ADR-0049): state, watchers, hooks,
    // template refs and `emit` are written as Vue writes them, listeners as `@click`, their
    // options as Vue's modifiers (`.capture`, `.once`, `.passive`, which runtime-dom passes to
    // `addEventListener`), on the DOM's own events.
    interactivity: { support: "native" },
    "event-capture": { support: "native" },
    "event-once": { support: "native" },
    "event-passive": { support: "native" },
    "event-semantics": { support: "native" },
    "conditional-event-control": { support: "native" },
    "use-id": { support: "native" },
    "next-tick": { support: "native" },
    // Vue's props are reactive whatever keys a parent passes.
    "late-prop": { support: "native" },
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
    "model-modifiers": { support: "native" },
    fallthrough: { support: "native" },
    "contextual-root": { support: "native" },
    expose: { support: "native" },
    context: { support: "native" },
    "reactive-context": { support: "native" },
    "dynamic-component": { support: "native" },
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    // Composition's cells are declared before this target emits it (ADR-0055): until M3's lane
    // for Vue lands, a component that uses it is reported, never emitted without it (P2).
    const composition = compositionUse(context.module, component);
    if (composition) {
      context.report({
        code: "UF1002",
        severity: "error",
        message: `The vue target does not emit ${composition.what} yet: composition lands in M3.`,
        span: composition.span,
      });
      return [];
    }
    const { block, rewrite, listeners } = scriptSetup(component, context.module);
    // The component resolves the names of loop variables.
    const template = printMarkup(component.render, vueDialect, {
      level: 1,
      component,
      rewrite,
      attribute: (attribute) =>
        attribute.kind === "Event" ? listeners.attributes.get(attribute) : undefined,
    });
    const parts = [...(block === undefined ? [] : [block]), `<template>\n${template}\n</template>`];
    return [{ path: `${component.name}.vue`, contents: `${parts.join("\n\n")}\n` }];
  },
});

export default vue;
