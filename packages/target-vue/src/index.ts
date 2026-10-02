import { defineTarget, printMarkup, vueDialect } from "@unframework/codegen";
import type { OutputFile, Target } from "@unframework/codegen";
import type { UfComponent } from "@unframework/ir";

/** The Vue 3.5 target: single-file components with `<script setup>` and a template. */
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
  },
  emit(component: UfComponent): OutputFile[] {
    const template = printMarkup(component.render, vueDialect, { level: 1 });
    return [{ path: `${component.name}.vue`, contents: `<template>\n${template}\n</template>\n` }];
  },
});

export default vue;
