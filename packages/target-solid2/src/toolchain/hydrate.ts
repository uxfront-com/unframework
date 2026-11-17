// The Solid hydrate adapter (browser, L12, ADR-0095): hydrates the server's HTML with
// `hydrate`, then behaves as the mount adapter does.
import type { HydrateAdapter } from "@unframework.dev/codegen";
import { createComponent, sharedConfig } from "solid-js";
import { hydrate as hydrateRoot } from "solid-js/web";

import { listenerProps, reactiveProps } from "./client.ts";
import { asComponent } from "./component.ts";

/** What Solid's hydration script (`generateHydrationScript`) puts on the page. */
interface HydrationGlobal {
  events: unknown[];
  completed: WeakSet<Node>;
  r: Record<string, unknown>;
  fe(): void;
  done?: boolean;
}

/**
 * Hydrates `html` (from `renderForHydration`, compiled hydratable on both sides) in the container
 * with `hydrate`. Each hydration starts from a fresh `_$HY`, the record Solid's hydration script
 * would put on a page, and an unfinished `sharedConfig`: a page that shares several spec files
 * keeps both from the last hydration (ADR-0092). Solid reports a structure it cannot hydrate by
 * throwing ("Hydration Mismatch", or "Failed attempt to create new DOM elements during
 * hydration"), which fails the mount; it checks no text or attribute, which the `client
 * agreement` sub-check compares instead (ADR-0095). A rerender assigns the props, as the mount
 * adapter's does.
 */
export const hydrate: HydrateAdapter = async (component, container, html, options) => {
  const solidComponent = asComponent(component);
  const listeners = listenerProps(options.on);
  const props = reactiveProps({ ...options.props, ...listeners });
  const page = globalThis as { _$HY?: HydrationGlobal };
  page._$HY = { events: [], completed: new WeakSet(), r: {}, fe() {} };
  sharedConfig.done = false;
  container.innerHTML = html;
  let dispose: () => void;
  try {
    dispose = hydrateRoot(() => createComponent(solidComponent, props.value), container);
  } finally {
    // Hydration is over: the events Solid replays and the nodes it completed are not kept.
    page._$HY.done = true;
    sharedConfig.done = true;
  }
  const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve));
  await settle();
  return {
    settle,
    async rerender(next) {
      props.assign({ ...next, ...listeners });
      await settle();
    },
    unmount: async () => dispose(),
    // Solid throws for what it cannot hydrate, and checks nothing else.
    takeMismatches: () => [],
  };
};
