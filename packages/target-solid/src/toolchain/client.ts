// The Solid mount adapter (browser). Solid updates the DOM synchronously, so a mounted
// component has rendered by the time `render` returns.
import type { MountAdapter } from "@unframework/codegen";
import { batch, createComponent } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { render } from "solid-js/web";

import { asComponent } from "./component.ts";

/**
 * Mounts a Solid component with `render`. Its props are a store, as a parent's spread of one
 * would be (`<C {...props} />`): reading a prop tracks it, and `mergeProps` sees keys come and
 * go, so a removed prop takes its default. A rerender replaces each prop by value, as a parent
 * passing new props does, rather than reconciling it into the old one by `id`: the component
 * receives what it was given.
 */
export const mount: MountAdapter = async (component, container, options) => {
  const solidComponent = asComponent(component);
  const [props, setProps] = createStore<Record<string, unknown>>({ ...options.props });
  const dispose = render(() => createComponent(solidComponent, props), container);
  // Solid applies updates synchronously; one microtask lets work that the component queued on
  // a promise run before the test reads the DOM.
  const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve));
  return {
    settle,
    async rerender(next) {
      batch(() =>
        setProps(
          produce((draft) => {
            for (const key of Object.keys(draft)) {
              if (!Object.hasOwn(next, key)) Reflect.deleteProperty(draft, key);
            }
            Object.assign(draft, next);
          }),
        ),
      );
      await settle();
    },
    unmount: async () => dispose(),
  };
};
