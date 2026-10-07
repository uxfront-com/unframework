// The component the Qwik mount adapter renders: it renders the mounted component with the props
// a signal holds, so a rerender is setting the signal (browser). Qwik has no public way to
// update a root's props, and a component built by hand from a QRL renders an error host
// instead: this one is compiled by the optimizer, like the output under test, which the
// toolchain's Vite configuration runs on every module, this one included.
import { component$ } from "@qwik.dev/core";
import type { Component, Signal } from "@qwik.dev/core";

import { withProps } from "./element.ts";

/** The props the host renders the component with, and the key of the instance they go to. */
export interface HostState {
  props: Record<string, unknown>;
  /** The component's key: a new key is a new instance. */
  key: string;
}

/** What the host renders: the component, and the signal holding its props. */
export interface HostProps {
  component: Component<Record<string, unknown>>;
  state: Signal<HostState>;
}

/**
 * Renders `component` with the signal's props, whole, as a parent's written attributes deliver
 * them (`null` included, ./element.ts): when the signal holds new props, a prop they lack is
 * `undefined` in the component, so its default applies. Under a key, as a parent's template
 * renders it: new props render the same instance again, which keeps its state and runs its
 * handlers with the new props, rather than a new instance in its place (ADR-0050).
 */
export const Host: Component<HostProps> = component$<HostProps>((host) =>
  withProps(host.component, host.state.value.props, host.state.value.key),
);
