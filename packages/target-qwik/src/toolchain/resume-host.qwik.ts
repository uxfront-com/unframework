// The component the Qwik hydrate adapter resumes (L12, ADR-0095): rendered on the server around
// the component under test, it renders it with the props a signal holds, while the signal says
// it is mounted. A resumed container has no public way to set its root's props or to clean up,
// so the page reaches this host's signal once the container has resumed, and a rerender or an
// unmount is setting it, as the mount adapter's `Host` is (./host.qwik.ts). Compiled by the
// optimizer, like the output under test, hence the `.qwik.ts` name.
import { component$ } from "@qwik.dev/core";
import type { Component, Signal } from "@qwik.dev/core";

import { withProps } from "./element.ts";

/** What the host renders: the props, the instance's key, and whether the component is mounted. */
export interface ResumeState {
  props: Record<string, unknown>;
  key: string;
  mounted: boolean;
}

/** The host's props: the component, and the signal of its state. */
export interface ResumeHostProps {
  component: Component<Record<string, unknown>>;
  state: Signal<ResumeState>;
}

/** Renders `component` with the signal's props while it is mounted, and nothing after. */
export const ResumeHost: Component<ResumeHostProps> = component$<ResumeHostProps>((host) =>
  host.state.value.mounted
    ? withProps(host.component, host.state.value.props, host.state.value.key)
    : null,
);
