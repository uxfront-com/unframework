import { defineTarget, printMarkup, vueDialect } from "@unframework/codegen";
import type { EmitContext, OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

import { scriptSetup } from "./script.ts";

/**
 * The Vue 3.5 target, the reference (D10): single-file components. A component is its
 * `<script setup lang="ts">` when it takes props (`script.ts`), then its template, printed in
 * `vueDialect` (design §5.2). A component without props is a template alone.
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
  },
  emit(component: UfComponent, context: EmitContext): OutputFile[] {
    const { block, rewrite } = scriptSetup(component, context.module);
    // The component resolves the names of loop variables and tells whether a spread's object
    // may be absent (read through `?.`).
    const template = printMarkup(component.render, vueDialect, {
      level: 1,
      component,
      ...(rewrite ? { rewrite } : {}),
    });
    const parts = [...(block === undefined ? [] : [block]), `<template>\n${template}\n</template>`];
    return [{ path: `${component.name}.vue`, contents: `${parts.join("\n\n")}\n` }];
  },
});

export default vue;
