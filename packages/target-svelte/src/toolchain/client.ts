import type { MountAdapter } from "@unframework/codegen";
import { flushSync, mount as mountComponent, settled, unmount } from "svelte";
import type { Component } from "svelte";

/**
 * Mounts a compiled Svelte component in the browser. `flushSync` runs the effects the first
 * render scheduled; `settled` also waits for asynchronous work and the DOM updates it causes.
 */
export const mount: MountAdapter = async (component, container, { props }) => {
  const instance = mountComponent(component as Component<Record<string, unknown>>, {
    target: container,
    props: { ...props },
  });
  flushSync();
  return {
    settle: () => settled(),
    unmount: () => unmount(instance),
  };
};
