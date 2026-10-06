import type { MountAdapter } from "@unframework/codegen";
import { flushSync, mount as mountComponent, settled, unmount } from "svelte";
import type { Component } from "svelte";

import { reactiveProps } from "./props.svelte.ts";

/**
 * Mounts a compiled Svelte component in the browser. `flushSync` runs the effects the first
 * render scheduled; `settled` also waits for asynchronous work and the DOM updates it causes.
 * The props are a `$state` object, which a rerender updates in place (see `props.svelte.ts`).
 */
export const mount: MountAdapter = async (component, container, { props }) => {
  const current = reactiveProps({ ...props });
  const instance = mountComponent(component as Component<Record<string, unknown>>, {
    target: container,
    props: current.props,
  });
  flushSync();
  return {
    settle: () => settled(),
    async rerender(next) {
      current.replace(next);
      flushSync();
      await settled();
    },
    unmount: () => unmount(instance),
  };
};
