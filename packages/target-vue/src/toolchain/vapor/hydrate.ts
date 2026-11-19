// The Vue Vapor hydrate adapter (browser, L12, ADR-0095, ADR-0112): hydrates the server's HTML with
// a Vapor SSR app, then behaves as the mount adapter does.
import type { HydrateAdapter } from "@unframework.dev/codegen";
import { createSSRApp, h, nextTick, shallowReactive, Suspense } from "vue";
import type { App, Component } from "vue";

import { isAsync, listenerProps } from "./client.ts";
import { assertVaporComponent, vaporApi } from "./guard.ts";

const { createVaporSSRApp, vaporInteropPlugin } = vaporApi();

/** Vue's hydration warnings start with `Hydration`, and its summary line names the mismatches. */
const MISMATCH = /^Hydration\b/;
const SUMMARY = /^Hydration completed but contains mismatches/;

/**
 * Hydrates `html` (from `renderForHydration`) in the container with `createVaporSSRApp`, or an
 * async root under `<Suspense>` as the mount adapter does, whose root takes its props as the
 * mount adapter's does, from a `shallowReactive` record, so a rerender
 * works the same way. Vue reports a mismatch through its warn handler, which the adapter takes as
 * a mismatch; any other warning goes on to `console.warn`, as Vue's default handler sends it. Vue
 * also logs one summary line through `console.error` for the page, which the adapter takes too.
 */
export const hydrate: HydrateAdapter = async (component, container, html, { props, on }) => {
  assertVaporComponent(component);
  const current: Record<string, unknown> = shallowReactive({ ...props });
  const listeners = listenerProps(on);
  const mismatches: string[] = [];
  const rootProps = () => ({ ...current, ...listeners });
  // As the mount adapter: an async setup renders only under a `<Suspense>`, a virtual-DOM
  // component that a Vapor app renders through `vaporInteropPlugin` (ADR-0101, ADR-0112).
  const app: App = isAsync(component)
    ? createSSRApp({
        render: () => h(Suspense, null, { default: () => h(component as Component, rootProps()) }),
      })
    : createVaporSSRApp(component, { $: [rootProps] });
  app.use(vaporInteropPlugin);
  app.config.warnHandler = (message, _instance, trace) => {
    if (MISMATCH.test(message)) mismatches.push(message);
    else console.warn(`[Vue warn]: ${message}${trace ? `\n${trace}` : ""}`);
  };
  container.innerHTML = html;
  const { error } = console;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && SUMMARY.test(args[0])) mismatches.push(args[0]);
    else error(...args);
  };
  try {
    app.mount(container);
  } finally {
    console.error = error;
  }
  await nextTick();
  return {
    async settle() {
      await nextTick();
    },
    async rerender(next) {
      for (const key of Object.keys(current)) {
        if (!Object.hasOwn(next, key)) Reflect.deleteProperty(current, key);
      }
      Object.assign(current, next);
      await nextTick();
    },
    async unmount() {
      app.unmount();
    },
    takeMismatches: () => mismatches.splice(0),
  };
};
