import type { MountAdapter } from "@unframework/codegen";
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
 */
export const mount: MountAdapter = async (component, container, { props }) => {
  const current: Record<string, unknown> = shallowReactive({ ...props });
  const app = createApp({ render: () => h(component as Component, { ...current }) });
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
