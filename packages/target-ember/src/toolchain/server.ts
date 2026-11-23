// `ember-source` publishes its modules' types as ambient declarations.
/// <reference types="ember-source/types" />
import { renderSettled } from "@ember/renderer";
import type { HydrationRenderer, SsrRenderer } from "@unframework.dev/codegen";
import { createEmberApp } from "vite-ember-ssr/server";

import { appFor } from "./app.ts";

// Node warns once, at the first read of its own `localStorage` without a file, which happy-dom's
// window makes. Reading it as the module loads keeps that warning out of a render's console.
void Reflect.get(globalThis, "localStorage");

/**
 * What the render waits for before it serializes: the render again for what an immediate watcher
 * writes, as Vue's render shows it. A render error reaches Node as an unhandled rejection a timer
 * later, so this waits a timer first, as `@ember/test-helpers`' `settled` does, and the render
 * reports the error.
 */
async function settled(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve));
  await renderSettled();
}

/**
 * Renders a compiled Ember component on the server as an app renders it there: vite-ember-ssr
 * boots an application under a happy-dom window and serialises what it renders, with Glimmer's
 * rehydration markers. The app's application template invokes the component with the props as
 * its arguments (`appFor`), and returns only the component's HTML: the body holds nothing else.
 */
export const renderToString: SsrRenderer = async (component, { props = {} }) =>
  render(component, Object.keys(props), props);

/**
 * Renders the server HTML the hydrate adapter hydrates (L12, ADR-0095): the same app, which
 * names the listeners' arguments too, as the client's names them, so the client builds the tree
 * the server serialised.
 */
export const renderForHydration: HydrationRenderer = async (component, { props = {}, on = {} }) => {
  const args: Record<string, unknown> = { ...props };
  for (const name of Object.keys(on)) args[listenerArgument(name)] = () => {};
  return render(component, Object.keys(args), args);
};

/** A parent's argument for a listener of `change`: `onChange`. */
function listenerArgument(event: string): string {
  return `on${event.charAt(0).toUpperCase()}${event.slice(1)}`;
}

async function render(
  component: unknown,
  names: readonly string[],
  args: Record<string, unknown>,
): Promise<string> {
  const App = appFor(component, names, args);
  const app = await createEmberApp("uf-ssr", {
    dev: {
      ssrLoadModule: async () => ({
        createSsrApp: () => App.create({ autoboot: false }),
        settled,
      }),
    },
  });
  try {
    const { body, error } = await app.renderRoute("/");
    if (error) throw error;
    return body;
  } finally {
    await app.destroy();
  }
}
