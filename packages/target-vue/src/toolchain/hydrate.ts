// The Vue hydrate adapter (browser, L12, ADR-0095): hydrates the server's HTML with an SSR app,
// then behaves as the mount adapter does.
import type { HydrateAdapter, MountListener } from "@unframework.dev/codegen";
import { createSSRApp, h, nextTick, shallowReactive } from "vue";
import type { Component } from "vue";

/** Vue's hydration warnings start with `Hydration`, and its summary line names the mismatches. */
const MISMATCH = /^Hydration\b/;
const SUMMARY = /^Hydration completed but contains mismatches/;

/**
 * Hydrates `html` (from `renderForHydration`) in the container with `createSSRApp`, whose root
 * renders the component as the mount adapter's root does, from a `shallowReactive` record, so a
 * rerender works the same way. Vue reports a mismatch through its warn handler, which the adapter
 * takes as a mismatch; any other warning goes on to `console.warn`, as Vue's default handler
 * sends it. Vue also logs one summary line through `console.error` for the page, which the
 * adapter takes too.
 */
export const hydrate: HydrateAdapter = async (component, container, html, { props, on }) => {
  const current: Record<string, unknown> = shallowReactive({ ...props });
  const listeners = listenerProps(on);
  const mismatches: string[] = [];
  const app = createSSRApp({
    render: () => h(component as Component, { ...current, ...listeners }),
  });
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

/** Vue's listener props for the test's listeners: `onChange` for `change` (`toHandlerKey`). */
function listenerProps(
  on: Readonly<Record<string, MountListener>> = {},
): Record<string, MountListener> {
  return Object.fromEntries(
    Object.entries(on).map(([name, listener]) => [
      `on${name.charAt(0).toUpperCase()}${name.slice(1)}`,
      listener,
    ]),
  );
}
