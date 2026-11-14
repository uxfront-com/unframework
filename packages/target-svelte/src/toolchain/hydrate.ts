// The Svelte hydrate adapter (browser, L12, ADR-0095): hydrates the server's HTML with
// `hydrate`, then behaves as the mount adapter does.
import type { HydrateAdapter } from "@unframework.dev/codegen";
import { flushSync, hydrate as hydrateComponent, settled, unmount } from "svelte";
import type { Component } from "svelte";

import { listenerProps } from "./client.ts";
import { reactiveProps } from "./props.svelte.ts";

/** Svelte's hydration warnings: `hydration_mismatch`, `hydration_attribute_changed` and so on. */
const MISMATCH = /\[svelte\] hydration_|svelte\.dev\/e\/hydration_/;

/**
 * Hydrates `html` (from `renderForHydration`) in the container with `hydrate`, and
 * `recover: false`, so a structure Svelte cannot hydrate throws `hydration_failed` rather than
 * rendering on the client in its place. Svelte reports what it repairs or ignores through
 * `[svelte] hydration_*` warnings on the console, which the adapter takes as mismatches; they
 * still reach the page's console. Svelte keeps the server's text and attributes where they
 * differ, which the `DOM` and `client agreement` sub-checks see.
 */
export const hydrate: HydrateAdapter = async (component, container, html, { props, on }) => {
  const listeners = listenerProps(on);
  const current = reactiveProps({ ...props, ...listeners });
  const mismatches: string[] = [];
  container.innerHTML = html;
  const { warn } = console;
  console.warn = (...args: unknown[]) => {
    const message = args.map(String).join(" ");
    if (MISMATCH.test(message)) mismatches.push(message.replace(/%c/g, ""));
    warn(...args);
  };
  let instance: Record<string, unknown>;
  try {
    instance = hydrateComponent(component as Component<Record<string, unknown>>, {
      target: container,
      props: current.props,
      recover: false,
    });
    flushSync();
  } finally {
    console.warn = warn;
  }
  return {
    settle: () => settled(),
    async rerender(next) {
      current.replace({ ...next, ...listeners });
      flushSync();
      await settled();
    },
    unmount: () => unmount(instance),
    takeMismatches: () => mismatches.splice(0),
  };
};
