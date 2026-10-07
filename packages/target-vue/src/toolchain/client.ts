import type { MountAdapter, MountListener } from "@unframework/codegen";
import { createApp, h, nextTick, shallowReactive } from "vue";
import type { Component } from "vue";

/**
 * Mounts a compiled Vue component in the browser. `mount` renders synchronously; `nextTick`
 * flushes the scheduler, so watchers and post-flush effects have run when it resolves.
 *
 * Root props cannot change, so the app's root is a render function that passes the props on,
 * as a parent's template would, from a reactive object: a rerender deletes the keys the new
 * props lack and assigns the others. Vue then gives a removed prop its default, and removes a
 * removed attribute. The object is shallow, so each value reaches the component as it was given.
 *
 * The test's listeners go beside the props, `onChange` for an event `change` (ADR-0012), as a
 * parent's `@change` does, so a rerender never removes them. The test listens to the events the
 * component declares only: an `onX` it does not declare would fall through to its root element
 * as a native listener.
 */
export const mount: MountAdapter = async (component, container, { props, on }) => {
  const current: Record<string, unknown> = shallowReactive({ ...props });
  const listeners = listenerProps(on);
  const app = createApp({ render: () => h(component as Component, { ...current, ...listeners }) });
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
