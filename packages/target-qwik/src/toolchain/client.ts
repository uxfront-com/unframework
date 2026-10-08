// Client-rendered elements keep their handlers in `element._qDispatch`, and the global
// qwikloader (document-level event delegation) is what calls them: without it, a click does
// nothing and nothing is logged.
// oxlint-disable-next-line import/no-unassigned-import -- the loader is a script run for its side effect
import "@qwik.dev/core/qwikloader.js";
import { createSignal, jsx, render } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";
// Qwik 2 has no public way to wait for a container's pending render yet.
import { _getDomContainer, _waitUntilRendered } from "@qwik.dev/core/internal";
import type { MountAdapter, MountListener } from "@unframework/codegen";

import { asComponent } from "./component.ts";
import { Host } from "./host.ts";
import type { HostState } from "./host.ts";
import { listenerQrl } from "./listener.ts";
import { nextTask, SegmentLoads } from "./loads.ts";

/** The segments loading in the page, which the toolchain's browser build reports (./loads.ts). */
const loads = new SegmentLoads();
loads.install();

/**
 * Mounts a compiled Qwik component with a client-only render (no SSR, no resumption). The
 * component is rendered by `Host` (./host.ts), which passes it the props a signal holds: a
 * rerender sets the signal. Qwik marks the container `q:container="resumed"` and refuses to
 * render into it twice, so every mount needs a fresh container. `render()` resolves after the
 * first render, component segments included; `settle()` waits for the render a later update
 * scheduled.
 *
 * Event handlers load lazily: a user's action dispatches through the loader, which runs the
 * handler's QRL once it has resolved, and only then is a render scheduled. The adapter checks an
 * app whose listeners have each run once (ADR-0050): before it renders, and before each input
 * of a user's action (`interact`), it loads every segment the component's QRLs reference and
 * resolves the QRLs (./loads.ts), so the handlers run inside the dispatch, in the DOM's order. A
 * first run, which ADR-0050 declares outside the contract, is never checked; of what it would
 * break, a control a `$` handler's body calls during the dispatch is reported on the console.
 * `interact` and `settle` wait for every import in flight; `interact` also waits for the
 * handlers the input started while they settle, but not for one that waits on something else
 * once nothing is loading (a handler awaiting the user's next click). The test's listeners are QRL props,
 * `onChange$` for an event `change` (ADR-0012), resolved before the mount: they are the test's,
 * not the component's lazy code.
 */
export const mount: MountAdapter = async (component, container, options) => {
  const listeners = await listenerProps(options.on);
  await loads.preload();
  let instances = 0;
  const state = createSignal<HostState>({
    props: { ...options.props, ...listeners },
    key: `uf-mounted-${instances}`,
  });
  const result = await render(container, jsx(Host, { component: asComponent(component), state }));
  const qwik = _getDomContainer(container);
  const settle = async () => {
    do {
      await loads.idle();
      await _waitUntilRendered(qwik);
    } while (loads.loading);
  };
  return {
    settle,
    async rerender(next) {
      const props = { ...next, ...listeners };
      // Qwik keeps an instance's empty props as one object it shares with every other empty
      // props (core's `EMPTY_OBJ`), and writes the new props of the instance into it, where
      // every later element would read them. A component that had no props at all gets new
      // ones as a new instance, as a parent that starts writing attributes renders one.
      const none = !Object.keys(state.value.props).length;
      if (none && Object.keys(props).length) instances += 1;
      state.value = { props, key: `uf-mounted-${instances}` };
      await settle();
    },
    async interact(action) {
      // A segment that a render since the mount brought in (a component's) is fetched too.
      await loads.preload();
      const started = new Set<Promise<unknown>>();
      const restore = trackHandlers(container, started);
      try {
        const outcome = await action();
        // Until the handlers settled, or those left wait on something other than a segment for
        // two tasks (the user's next action, a timer), with no new handler started meanwhile.
        for (;;) {
          await loads.idle();
          const seen = started.size;
          await Promise.race([Promise.allSettled(started), nextTask().then(nextTask)]);
          if (!loads.loading && started.size === seen) break;
        }
        return outcome;
      } finally {
        restore();
      }
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

/** Qwik's QRL props for the test's listeners: `onChange$` for `change`, each resolved. */
async function listenerProps(
  on: Readonly<Record<string, MountListener>> = {},
): Promise<Record<string, QRL<MountListener>>> {
  const entries = await Promise.all(
    Object.entries(on).map(async ([name, listener]): Promise<[string, QRL<MountListener>]> => {
      const qrl = listenerQrl(listener);
      await qrl.resolve();
      return [`on${name.charAt(0).toUpperCase()}${name.slice(1)}$`, qrl];
    }),
  );
  return Object.fromEntries(entries);
}

/** What the loader calls on an element for an event: one handler, or several in order. */
type Dispatch = Record<string, unknown>;

/**
 * Records in `started` the promise of every event handler the container's elements run until
 * restored. A client-rendered element keeps its handlers in `_qDispatch`, which the global
 * loader calls (core's `runEventHandlerQRL`, which resolves the handler's segment, runs it and
 * resolves once it is done); each is wrapped in place. The adapter waits for them; it never
 * resolves a handler itself, which would hide a handler that fails to load.
 */
function trackHandlers(container: HTMLElement, started: Set<Promise<unknown>>): () => void {
  const wrapped: { dispatch: Dispatch; name: string; original: unknown; wrapper: unknown }[] = [];
  const wrap = (handler: unknown): unknown =>
    typeof handler === "function"
      ? function (this: unknown, ...args: unknown[]): unknown {
          const value: unknown = handler.apply(this, args);
          if (isThenable(value)) started.add(Promise.resolve(value));
          return value;
        }
      : handler;
  for (const element of [container, ...container.querySelectorAll("*")]) {
    const dispatch = (element as { _qDispatch?: Dispatch })._qDispatch;
    if (!dispatch) continue;
    for (const [name, original] of Object.entries(dispatch)) {
      const wrapper = Array.isArray(original) ? original.map(wrap) : wrap(original);
      dispatch[name] = wrapper;
      wrapped.push({ dispatch, name, original, wrapper });
    }
  }
  return () => {
    // A handler a render replaced since is the new render's own.
    for (const { dispatch, name, original, wrapper } of wrapped) {
      if (dispatch[name] === wrapper) dispatch[name] = original;
    }
  };
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}
