// Client-rendered elements keep their handlers in `element._qDispatch`, and the global
// qwikloader (document-level event delegation) is what calls them: without it, a click does
// nothing and nothing is logged.
// oxlint-disable-next-line import/no-unassigned-import -- the loader is a script run for its side effect
import "@qwik.dev/core/qwikloader.js";
import { createSignal, jsx, render } from "@qwik.dev/core";
// Qwik 2 has no public way to wait for a container's pending render yet.
import { _getDomContainer, _waitUntilRendered } from "@qwik.dev/core/internal";
import type { MountAdapter } from "@unframework/codegen";

import { asComponent } from "./component.ts";
import { Host } from "./host.ts";

/**
 * Mounts a compiled Qwik component with a client-only render (no SSR, no resumption). The
 * component is rendered by `Host` (./host.ts), which passes it the props a signal holds: a
 * rerender sets the signal. Qwik marks the container `q:container="resumed"` and refuses to
 * render into it twice, so every mount needs a fresh container. `render()` resolves after the
 * first render, component segments included; `settle()` waits for the render a later update
 * scheduled. Event handlers load lazily, so an update may be scheduled only after its segment
 * arrives: specs assert with retrying `expect.element`.
 */
export const mount: MountAdapter = async (component, container, options) => {
  const props = createSignal<Record<string, unknown>>({ ...options.props });
  const result = await render(container, jsx(Host, { component: asComponent(component), props }));
  const qwik = _getDomContainer(container);
  const settle = () => _waitUntilRendered(qwik);
  return {
    settle,
    async rerender(next) {
      props.value = { ...next };
      await settle();
    },
    async unmount() {
      result.cleanup();
      // Cleanup schedules visible-task cleanups on the container; let them run, then remove
      // the DOM Qwik leaves behind, as every other target's unmount does.
      await settle();
      container.replaceChildren();
    },
  };
};
