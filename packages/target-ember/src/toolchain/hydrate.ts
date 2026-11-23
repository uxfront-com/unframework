// The Ember hydrate adapter (browser, L12, ADR-0095): boots the app the server rendered with
// (`appFor`) in rehydrate mode, so Glimmer adopts the server's DOM, as vite-ember-ssr's client
// boots a page, then behaves as the mount adapter does.
// `ember-source` publishes its modules' types as ambient declarations.
/// <reference types="ember-source/types" />
import type ApplicationInstance from "@ember/application/instance";
import { trackedObject } from "@ember/reactive/collections";
import { renderSettled } from "@ember/renderer";
import type { HydrateAdapter, MountedComponent } from "@unframework.dev/codegen";

import { appFor } from "./app.ts";
import { mount } from "./client.ts";

/** A parent's argument for a listener of `change`: `onChange`. */
function listenerArgument(event: string): string {
  return `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;
}

/**
 * Hydrates `html` (from `renderForHydration`) in the container: the app's `visit` with
 * `_renderMode: "rehydrate"` builds the component's tree on the server's nodes. Its arguments are
 * a tracked object, which a rerender updates key by key. Glimmer reports no mismatch: where a
 * node differs, it renders the client's in its place.
 */
export const hydrate: HydrateAdapter = async (
  component,
  container,
  html,
  { props = {}, on = {} },
) => {
  const listeners: Record<string, unknown> = {};
  for (const [name, listener] of Object.entries(on)) listeners[listenerArgument(name)] = listener;
  const args = trackedObject<Record<string, unknown>>({ ...props, ...listeners });
  const App = appFor(component, Object.keys(args), args);
  container.innerHTML = html;
  const app = App.create({ autoboot: false, rootElement: container });
  // Ember types `rootElement` as its own DOM interface, which a browser element implements.
  type Options = Parameters<typeof app.visit>[1];
  const rootElement = container as unknown as NonNullable<Options["rootElement"]>;
  const instance = (await app.visit("/", {
    rootElement,
    _renderMode: "rehydrate",
  })) as ApplicationInstance;
  await renderSettled();
  // A rerender that adds a name renders the component again, as the mount adapter does: the
  // app's template names each argument once.
  let mounted: MountedComponent | undefined;
  return {
    settle: () => (mounted ? mounted.settle() : renderSettled()),
    async rerender(next) {
      if (mounted) return mounted.rerender(next);
      const values: Record<string, unknown> = { ...next, ...listeners };
      if (Object.keys(next).some((key) => !Object.hasOwn(args, key))) {
        instance.destroy();
        app.destroy();
        await renderSettled();
        const names: Record<string, unknown> = {};
        for (const key of Object.keys(props)) names[key] = undefined;
        mounted = await mount(component, container, { props: { ...names, ...next }, on });
        return;
      }
      for (const key of Object.keys(args)) {
        const value = Object.hasOwn(values, key) ? values[key] : undefined;
        if (!Object.is(args[key], value)) args[key] = value;
      }
      await renderSettled();
    },
    async unmount() {
      if (mounted) return mounted.unmount();
      instance.destroy();
      app.destroy();
      await renderSettled();
    },
    takeMismatches: () => [],
  };
};
