// The Solid 2 hydrate adapter (browser, L12, ADR-0095): hydrates the server's HTML with
// `hydrate`, then behaves as the mount adapter does.
import type { HydrateAdapter } from "@unframework.dev/codegen";
import { createComponent, flush } from "solid-js";
import { hydrate as hydrateRoot } from "@solidjs/web";

import { listenerProps, reactiveProps, settle } from "./client.ts";
import { asComponent } from "./component.ts";
import { assertSolid2 } from "./guard.ts";

assertSolid2();

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
 * would put on a page: a page that shares several spec files keeps it from the last hydration
 * (ADR-0092). Solid reports a structure it cannot hydrate by throwing, which fails the mount; it
 * checks no text or attribute, which the `client agreement` sub-check compares instead
 * (ADR-0095). A rerender assigns the props, as the mount adapter's does.
 */
export const hydrate: HydrateAdapter = async (component, container, html, options) => {
  const solidComponent = asComponent(component);
  const listeners = listenerProps(options.on);
  const props = reactiveProps({ ...options.props, ...listeners });
  const page = globalThis as { _$HY?: HydrationGlobal };
  page._$HY = { events: [], completed: new WeakSet(), r: {}, fe() {} };
  container.innerHTML = html;
  let dispose: () => void;
  try {
    dispose = hydrateRoot(() => createComponent(solidComponent, props.value), container);
    flush();
  } finally {
    // Hydration is over: the events Solid replays and the nodes it completed are not kept.
    page._$HY.done = true;
  }
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
