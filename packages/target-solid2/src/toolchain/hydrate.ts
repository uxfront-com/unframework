import { hydrate as hydrateRoot } from "@solidjs/web";
// The Solid 2 hydrate adapter (browser, L12, ADR-0095): hydrates the server's HTML with
// `hydrate`, then behaves as the mount adapter does.
import type { HydrateAdapter } from "@unframework.dev/codegen";
import { createComponent, flush } from "solid-js";

import { listenerProps, reactiveProps, reviveReactivity, settle } from "./client.ts";
import { asComponent } from "./component.ts";
import { assertSolid2 } from "./guard.ts";

assertSolid2();

/** What Solid's hydration script (`generateHydrationScript`) puts on the page. */
interface HydrationGlobal {
  events: Array<unknown>;
  completed: WeakSet<Node>;
  r: Record<string, unknown>;
  fe(): void;
  done?: boolean;
}

/**
 * Hydrates `html` (from `renderForHydration`, compiled hydratable on both sides) in the container
 * with `hydrate`, once its scripts have run. Each hydration starts from a fresh `_$HY`, the record Solid's hydration script
 * would put on a page: a page that shares several spec files keeps it from the last hydration
 * (ADR-0092). Solid reports a structure it cannot hydrate by throwing, which fails the mount; it
 * checks no text or attribute, which the `client agreement` sub-check compares instead
 * (ADR-0095). A rerender assigns the props, as the mount adapter's does.
 */
export const hydrate: HydrateAdapter = async (component, container, html, options) => {
  reviveReactivity();
  const solidComponent = asComponent(component);
  const listeners = listenerProps(options.on);
  const props = reactiveProps({ ...options.props, ...listeners });
  const page = globalThis as { _$HY?: HydrationGlobal };
  page._$HY = { events: [], completed: new WeakSet(), r: {}, fe() {} };
  container.innerHTML = html;
  // Markup runs no script: run the server's, which record what its async setups awaited in
  // `_$HY.r` (the bootstrap one finds the record there already), then take them out of the DOM.
  for (const script of container.querySelectorAll("script")) {
    // oxlint-disable-next-line typescript/no-implied-eval -- runs the server render's own scripts, as a page would
    new Function(script.textContent ?? "")();
    script.remove();
  }
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
    unmount: async () => {
      reviveReactivity();
      dispose();
    },
    // Solid throws for what it cannot hydrate, and checks nothing else.
    takeMismatches: () => [],
  };
};
