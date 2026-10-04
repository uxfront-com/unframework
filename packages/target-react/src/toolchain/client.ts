// The React mount adapter (browser). `act` flushes React's work, so a mounted or settled
// component has rendered and run its effects.
import type { MountAdapter } from "@unframework/codegen";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

import { asComponent } from "./component.ts";

/**
 * Mounts a React component with `createRoot`, inside `act`. A rerender renders the root again
 * with a new props object, as a parent does: a prop the object lacks is `undefined` in the
 * component, so its default applies.
 */
export const mount: MountAdapter = async (component, container, options) => {
  const type = asComponent(component);
  // Declares a test environment: without it React logs an error for every `act` call.
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
  const root = createRoot(container);
  try {
    // A render error inside `act` rejects here, rather than surfacing as a global error.
    await act(async () => root.render(createElement(type, { ...options.props })));
  } catch (error) {
    try {
      await act(async () => root.unmount());
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], "React failed to render, then to unmount.", {
        cause: cleanup,
      });
    }
    throw error;
  }
  return {
    settle: () => act(async () => {}),
    async rerender(props) {
      await act(async () => root.render(createElement(type, { ...props })));
    },
    unmount: () => act(async () => root.unmount()),
  };
};
