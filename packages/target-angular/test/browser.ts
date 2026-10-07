// What the browser tests share: a corpus case's component mounted by the toolchain's adapter, the
// emits it made (each `[name, ...args]`, in order), and the user's actions as the page makes
// them, each followed by the adapter's settle.
import type { MountedComponent, MountEvent } from "@unframework/codegen";
import { expect } from "vitest";

import { mount } from "../src/toolchain/client.ts";

/** A mounted component, what it emitted, and actions on it. */
export interface View {
  container: HTMLElement;
  mounted: MountedComponent;
  /** Every emit so far, `[name, ...args]`, in order. */
  events: unknown[][];
  /** The emits of one event, each its arguments. */
  emitted(name: string): unknown[][];
  /** The element that holds `text` exactly, among those matching `selector`. */
  get<T extends HTMLElement = HTMLElement>(selector: string, text?: string): T;
  /** Clicks an element, as a user does: a trusted-like click event that bubbles. */
  click(selector: string, text?: string): Promise<void>;
  /** Dispatches an event on an element, then settles; returns whether it was not prevented. */
  dispatch(selector: string, event: Event, text?: string): Promise<boolean>;
  rerender(props: Record<string, unknown>): Promise<void>;
  unmount(): Promise<void>;
}

const views: View[] = [];

/** Mounts a case's component with listeners for every event it declares. */
export async function render(
  component: unknown,
  declared: readonly MountEvent[],
  props: Record<string, unknown> = {},
): Promise<View> {
  const container = document.createElement("div");
  document.body.append(container);
  const events: unknown[][] = [];
  const on = Object.fromEntries(
    declared.map(({ name }) => [name, (...args: unknown[]) => void events.push([name, ...args])]),
  );
  const mounted = await mount(component, container, { props, on, events: declared });
  const get = <T extends HTMLElement>(selector: string, text?: string): T => {
    const found = [...container.querySelectorAll<T>(selector)].filter(
      (element) => text === undefined || element.textContent?.trim() === text,
    );
    expect(found, `${selector} ${text ?? ""}`).toHaveLength(1);
    return found[0]!;
  };
  const view: View = {
    container,
    mounted,
    events,
    emitted: (name) => events.filter(([event]) => event === name).map(([, ...args]) => args),
    get,
    async click(selector, text) {
      get(selector, text).click();
      await mounted.settle();
    },
    async dispatch(selector, event, text) {
      const allowed = get(selector, text).dispatchEvent(event);
      await mounted.settle();
      return allowed;
    },
    async rerender(next) {
      await mounted.rerender(next);
    },
    async unmount() {
      await mounted.unmount();
      container.remove();
    },
  };
  views.push(view);
  return view;
}

/** Unmounts every view a test left mounted. */
export async function cleanup(): Promise<void> {
  for (const view of views.splice(0)) {
    if (view.container.isConnected) await view.unmount();
  }
}
