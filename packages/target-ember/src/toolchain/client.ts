// `ember-source` publishes its modules' types as ambient declarations.
/// <reference types="ember-source/types" />
import { trackedObject } from "@ember/reactive/collections";
import { renderComponent, renderSettled } from "@ember/renderer";
import type { MountAdapter } from "@unframework.dev/codegen";

/**
 * Mounts a compiled Ember component in the browser with `renderComponent` (RFC 1099). Its
 * arguments are a tracked object, which a rerender updates key by key, as a parent's template
 * would pass new values: a key the next props lack is set to `undefined`, so its getter takes the
 * default.
 *
 * `renderComponent` reads the argument names once, as a parent's template names them, so a
 * rerender that adds a name renders the component again with every name so far.
 */
export const mount: MountAdapter = async (component, container, { props = {}, on = {} }) => {
  // A parent listens to an event through an argument, `@onChange` for `change`.
  const listeners = Object.fromEntries(
    Object.entries(on).map(([name, listener]) => [
      `on${name.charAt(0).toUpperCase()}${name.slice(1)}`,
      listener,
    ]),
  );
  let args = trackedObject<Record<string, unknown>>({ ...props, ...listeners });
  let result = renderComponent(component as object, { into: container, args });
  await renderSettled();
  return {
    settle: () => renderSettled(),
    async rerender(next) {
      next = { ...next, ...listeners };
      const added = Object.keys(next).filter((key) => !Object.hasOwn(args, key));
      if (added.length) {
        result.destroy();
        const names: Record<string, unknown> = {};
        for (const key of Object.keys(args)) names[key] = undefined;
        args = trackedObject<Record<string, unknown>>({ ...names, ...next });
        result = renderComponent(component as object, { into: container, args });
        await renderSettled();
        return;
      }
      for (const key of Object.keys(args)) {
        const value = Object.hasOwn(next, key) ? next[key] : undefined;
        if (!Object.is(args[key], value)) args[key] = value;
      }
      await renderSettled();
    },
    async unmount() {
      result.destroy();
      await renderSettled();
    },
  };
};
