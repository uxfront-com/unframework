// The React mount adapter (browser). `act` flushes React's work, so a mounted or settled
// component has rendered and run its effects.
import type { MountAdapter } from "@unframework.dev/codegen";
import { createElement } from "react";
import { createRoot } from "react-dom/client";

import { act, listenerProps } from "./act.ts";
import { asComponent } from "./component.ts";

/**
 * Mounts a React component with `createRoot`, inside `act`. A rerender renders the root again
 * with a new props object, as a parent does: a prop the object lacks is `undefined` in the
 * component, so its default applies. The test's listeners are props too, `onChange` for an
 * event `change`, as a parent passes them (ADR-0012), on every render.
 *
 * A user's action runs inside `act`, so its updates are flushed when it resolves. Work that
 * lands after it (an async handler's continuation, a timer) renders on React's own scheduler,
 * outside `act`, where React expects no test environment: the adapter declares one only around
 * its own `act` calls (ADR-0050), so such work is never reported as an update outside `act`.
 */
export const mount: MountAdapter = async (component, container, options) => {
  const type = asComponent(component);
  const listeners = listenerProps(options.on);
  const element = (props: Readonly<Record<string, unknown>>) =>
    createElement(type, { ...props, ...listeners });
  const root = createRoot(container);
  try {
    // A render error inside `act` rejects here, rather than surfacing as a global error.
    await act(async () => root.render(element(options.props ?? {})));
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
    async settle() {
      await act(async () => {});
      // What the scheduler queued outside `act` runs in a task of its own (a MessageChannel).
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    },
    async rerender(props) {
      await act(async () => root.render(element(props)));
    },
    interact: (action) => act(action),
    unmount: () => act(async () => root.unmount()),
  };
};
