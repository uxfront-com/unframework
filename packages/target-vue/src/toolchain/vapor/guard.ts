// The guards every vue-vapor adapter runs (ADR-0112): a vue-vapor layer that loads Vue 3.5 would
// compile and render the virtual DOM, and pass by accident wherever both render alike, so it
// fails at once instead.
import * as vue from "vue";
import type { App, Plugin } from "vue";

/**
 * Vue 3.6's Vapor apps, which this package's own types, Vue 3.5's, lack: at run time `vue`
 * resolves from the toolchain directory, Vue 3.6's (ADR-0112). A Vapor root takes raw props, each
 * a getter, or a dynamic source under `$`, as a compiled `v-bind="…"` passes them.
 */
export interface VaporApi {
  createVaporApp: (component: unknown, props: { $: (() => Record<string, unknown>)[] }) => App;
  createVaporSSRApp: (component: unknown, props: { $: (() => Record<string, unknown>)[] }) => App;
  vaporInteropPlugin: Plugin;
}

/** Vue 3.6's Vapor apps; throws unless `vue` is Vue 3.6 or later, which has them. */
export function vaporApi(): VaporApi {
  const exports: Record<string, unknown> = vue;
  const { createVaporApp, createVaporSSRApp, vaporInteropPlugin } = exports;
  if (
    typeof createVaporApp !== "function" ||
    typeof createVaporSSRApp !== "function" ||
    typeof vaporInteropPlugin !== "function"
  ) {
    throw new Error(
      `The vue-vapor project loaded vue ${vue.version}: vue must resolve from the toolchain directory, which holds Vue 3.6 (ADR-0112).`,
    );
  }
  return { createVaporApp, createVaporSSRApp, vaporInteropPlugin } as VaporApi;
}

/**
 * Throws unless a root component is a Vapor component, which Vue 3.6's client compile marks
 * `__vapor`: a component compiled for the virtual DOM would mount through interop and pass by
 * accident. Only the client's: Vue renders a Vapor component on the server with the same
 * `ssrRender` as any other, unmarked.
 */
export function assertVaporComponent(component: unknown): void {
  if ((component as { __vapor?: unknown } | null)?.__vapor === true) return;
  throw new Error(
    "The vue-vapor project mounted a component compiled for the virtual DOM: its output must be a Vapor component (`<script setup vapor>`), compiled by Vue 3.6 (ADR-0112).",
  );
}
