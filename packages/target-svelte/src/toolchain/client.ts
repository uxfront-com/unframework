import type { MountAdapter, MountListener } from "@unframework/codegen";
import { flushSync, mount as mountComponent, settled, unmount } from "svelte";
import type { Component } from "svelte";

import { reactiveProps } from "./props.svelte.ts";

/**
 * Mounts a compiled Svelte component in the browser. `flushSync` runs the effects the first
 * render scheduled; `settled` also waits for asynchronous work and the DOM updates it causes.
 * The props are read through a `$state.raw` record, which a rerender replaces: the values are the
 * caller's own, never deep proxies (see `props.svelte.ts`).
 * The test's listeners are callback props in it, `onchange` for an event `change` (the event's
 * name in lower case, D8), which every rerender keeps.
 */
export const mount: MountAdapter = async (component, container, { props, on }) => {
  const listeners = listenerProps(on);
  const current = reactiveProps({ ...props, ...listeners });
  const instance = mountComponent(component as Component<Record<string, unknown>>, {
    target: container,
    props: current.props,
  });
  flushSync();
  return {
    settle: () => settled(),
    async rerender(next) {
      current.replace({ ...next, ...listeners });
      flushSync();
      await settled();
    },
    unmount: () => unmount(instance),
  };
};

/** Svelte's callback props for the test's listeners: `onchange` for `change`, `onvaluechange` for `valueChange`. */
function listenerProps(
  on: Readonly<Record<string, MountListener>> = {},
): Record<string, MountListener> {
  return Object.fromEntries(
    Object.entries(on).map(([name, listener]) => [`on${name.toLowerCase()}`, listener]),
  );
}
