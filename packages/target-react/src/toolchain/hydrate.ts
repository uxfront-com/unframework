// The React hydrate adapter (browser, L12, ADR-0095): hydrates the server's HTML with
// `hydrateRoot`, inside `act`, then behaves as the mount adapter does.
import type { HydrateAdapter } from "@unframework.dev/codegen";
import { createElement } from "react";
import { hydrateRoot } from "react-dom/client";

import { act, listenerProps } from "./act.ts";
import { asComponent } from "./component.ts";

/**
 * React 19 reports an attribute that differs from the server's only on the console, in
 * development, and keeps the server's value: it is a mismatch too.
 */
const ATTRIBUTE_MISMATCH =
  /^A tree hydrated but some attributes of the server rendered HTML didn't match the client properties/;

/**
 * Hydrates `html` (from `renderForHydration`) in the container with `hydrateRoot`. React reports
 * a mismatch on two channels, and the adapter takes both: a text or structure mismatch, which
 * React recovers from by rendering on the client, through `onRecoverableError` (React 19 logs
 * nothing for it once that option is given), and an attribute mismatch through `console.error`,
 * which still reaches the page's console. A rerender renders the root again, as the mount
 * adapter's does.
 */
export const hydrate: HydrateAdapter = async (component, container, html, options) => {
  const type = asComponent(component);
  const listeners = listenerProps(options.on);
  const element = (props: Readonly<Record<string, unknown>>) =>
    createElement(type, { ...props, ...listeners });
  const mismatches: string[] = [];
  container.innerHTML = html;
  const { error } = console;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && ATTRIBUTE_MISMATCH.test(args[0])) {
      mismatches.push(`${args[0].split("\n")[0]}\n${args.slice(2).map(String).join("")}`.trim());
    }
    error(...args);
  };
  let root: ReturnType<typeof hydrateRoot>;
  try {
    await act(async () => {
      root = hydrateRoot(container, element(options.props ?? {}), {
        onRecoverableError: (cause) => {
          mismatches.push(cause instanceof Error ? cause.message : String(cause));
        },
      });
    });
  } finally {
    console.error = error;
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
    takeMismatches: () => mismatches.splice(0),
  };
};
