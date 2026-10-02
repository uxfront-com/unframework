import type { MountAdapter } from "@unframework/codegen";
import { createApp, nextTick } from "vue";
import type { Component } from "vue";

/**
 * Mounts a compiled Vue component in the browser. `mount` renders synchronously; `nextTick`
 * flushes the scheduler, so watchers and post-flush effects have run when it resolves.
 */
export const mount: MountAdapter = async (component, container, { props }) => {
  const app = createApp(component as Component, props ? { ...props } : null);
  app.mount(container);
  await nextTick();
  return {
    async settle() {
      await nextTick();
    },
    async unmount() {
      app.unmount();
    },
  };
};
