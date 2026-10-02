// The Solid mount adapter (browser). Solid updates the DOM synchronously, so a mounted
// component has rendered by the time `render` returns.
import type { MountAdapter } from "@unframework/codegen";
import { createComponent } from "solid-js";
import { render } from "solid-js/web";

import { asComponent } from "./component.ts";

/** Mounts a Solid component with `render`. */
export const mount: MountAdapter = async (component, container, options) => {
  const solidComponent = asComponent(component);
  const dispose = render(() => createComponent(solidComponent, { ...options.props }), container);
  return {
    // Solid applies updates synchronously; one microtask lets work that the component queued
    // on a promise run before the test reads the DOM.
    settle: () => new Promise<void>((resolve) => queueMicrotask(resolve)),
    unmount: async () => dispose(),
  };
};
