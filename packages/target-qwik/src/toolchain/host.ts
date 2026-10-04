// The component the Qwik mount adapter renders: it renders the mounted component with the props
// a signal holds, so a rerender is setting the signal (browser). Qwik has no public way to
// update a root's props, and a component built by hand from a QRL renders an error host
// instead: this one is compiled by the optimizer, like the output under test, which the
// toolchain's Vite configuration runs on every module, this one included.
import { component$, jsx } from "@qwik.dev/core";
import type { Component, Signal } from "@qwik.dev/core";

/** What the host renders: the component, and the signal holding its props. */
export interface HostProps {
  component: Component<Record<string, unknown>>;
  props: Signal<Record<string, unknown>>;
}

/**
 * Renders `component` with the signal's props, whole: when the signal holds new props, a
 * prop they lack is `undefined` in the component, so its default applies.
 */
export const Host: Component<HostProps> = component$<HostProps>((host) =>
  jsx(host.component, { ...host.props.value }),
);
