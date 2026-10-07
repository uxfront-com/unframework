// The Solid mount adapter (browser). Solid updates the DOM synchronously, so a mounted
// component has rendered by the time `render` returns.
import type { MountAdapter, MountListener } from "@unframework/codegen";
import { $PROXY, batch, createComponent, createSignal } from "solid-js";
import { render } from "solid-js/web";

import { asComponent } from "./component.ts";

/**
 * Mounts a Solid component with `render`. Its props are reactive as a parent's spread would make
 * them (`<C {...props} />`): reading a prop tracks that prop alone, and `mergeProps` sees keys come
 * and go, so a removed prop takes its default. The values are the ones the test passed, as a
 * parent passing plain data gives them, never a store's proxies: identity with them holds, and
 * `structuredClone` copies them. A rerender replaces each prop by value, as a parent passing new
 * props does; one it passes unchanged notifies nothing. The test's listeners are props too,
 * `onChange` for an event `change` (ADR-0012), which every rerender keeps.
 */
export const mount: MountAdapter = async (component, container, options) => {
  const solidComponent = asComponent(component);
  const listeners = listenerProps(options.on);
  const props = reactiveProps({ ...options.props, ...listeners });
  const dispose = render(() => createComponent(solidComponent, props.value), container);
  // Solid applies updates synchronously; one microtask lets work that the component queued on
  // a promise run before the test reads the DOM.
  const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve));
  return {
    settle,
    async rerender(next) {
      props.assign({ ...next, ...listeners });
      await settle();
    },
    unmount: async () => dispose(),
  };
};

/**
 * Props whose keys and values are signals, one per key: a proxy Solid's `mergeProps` reads as
 * one (`$PROXY`), so it resolves each key, present or not, when it is read.
 */
function reactiveProps(initial: Record<string, unknown>): {
  value: Record<string, unknown>;
  assign(next: Record<string, unknown>): void;
} {
  const values = new Map<string, [() => unknown, (value: unknown) => void]>();
  const entry = (key: string) => {
    let signal = values.get(key);
    if (!signal) {
      const [read, write] = createSignal<unknown>(undefined);
      // A function is a value here (a listener), never an update.
      signal = [read, (value) => write(() => value)];
      values.set(key, signal);
    }
    return signal;
  };
  const [keys, setKeys] = createSignal<readonly string[]>([], {
    equals: (a, b) => a.length === b.length && a.every((key, index) => key === b[index]),
  });
  const assign = (next: Record<string, unknown>) =>
    batch(() => {
      for (const key of values.keys()) if (!Object.hasOwn(next, key)) entry(key)[1](undefined);
      for (const [key, value] of Object.entries(next)) entry(key)[1](value);
      setKeys(Object.keys(next));
    });
  assign(initial);
  const value: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_target, key) =>
        key === $PROXY ? value : typeof key === "string" ? entry(key)[0]() : undefined,
      has: (_target, key) => key === $PROXY || (typeof key === "string" && keys().includes(key)),
      ownKeys: () => [...keys()],
      getOwnPropertyDescriptor: (_target, key) =>
        typeof key === "string" && keys().includes(key)
          ? { enumerable: true, configurable: true, value: entry(key)[0]() }
          : undefined,
    },
  );
  return { value, assign };
}

/** Solid's props for the test's listeners: `onChange` for `change`. */
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
