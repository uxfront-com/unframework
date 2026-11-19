// The Vue Vapor mount adapter (browser, ADR-0112): mounts a Vapor component in a Vapor app, with
// no virtual DOM, as a Vue 3.6 app written in Vapor mode does.
import type { MountAdapter, MountListener } from "@unframework.dev/codegen";
import { createApp, h, nextTick, shallowReactive, Suspense } from "vue";
import type { App, Component } from "vue";

import { assertVaporComponent, vaporApi } from "./guard.ts";

const { createVaporApp, vaporInteropPlugin } = vaporApi();

/**
 * Mounts a compiled Vapor component in the browser. `mount` renders synchronously; `nextTick`
 * flushes the scheduler, so watchers and post-flush effects have run when it resolves.
 *
 * The app takes `vaporInteropPlugin`, as a Vapor app that renders a virtual-DOM component does:
 * a parent's Vue output wraps an async child in `<Suspense>` (ADR-0101), which is one. A root whose
 * setup awaits renders under a `<Suspense>` of its own, as a hand-written host's would, in a
 * virtual-DOM app, since a Vapor root cannot take one.
 *
 * A Vapor root's props come from its raw props, which Vapor reads through getters: the root takes
 * one dynamic source, `$`, that reads a reactive record, as a parent's `v-bind="props"` does, so a
 * rerender deletes the keys the new props lack and assigns the others. Vue then gives a removed
 * prop its default, and removes a removed attribute. The record is shallow, so each value reaches
 * the component as it was given. The test's listeners go beside the props, `onChange` for an event
 * `change` (ADR-0012), as a parent's `@change` does, so a rerender never removes them.
 */
export const mount: MountAdapter = async (component, container, { props, on }) => {
  assertVaporComponent(component);
  const current: Record<string, unknown> = shallowReactive({ ...props });
  const listeners = listenerProps(on);
  const rootProps = () => ({ ...current, ...listeners });
  const app: App = isAsync(component)
    ? createApp({
        render: () => h(Suspense, null, { default: () => h(component as Component, rootProps()) }),
      })
    : createVaporApp(component, { $: [rootProps] });
  app.use(vaporInteropPlugin);
  app.mount(container);
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
  };
};

/** Whether a component's setup awaits (ADR-0101). */
export function isAsync(component: unknown): boolean {
  const { setup } = component as { setup?: unknown };
  return Object.prototype.toString.call(setup) === "[object AsyncFunction]";
}

/** Vue's listener props for the test's listeners: `onChange` for `change` (`toHandlerKey`). */
export function listenerProps(
  on: Readonly<Record<string, MountListener>> = {},
): Record<string, MountListener> {
  return Object.fromEntries(
    Object.entries(on).map(([name, listener]) => [
      `on${name.charAt(0).toUpperCase()}${name.slice(1)}`,
      listener,
    ]),
  );
}
