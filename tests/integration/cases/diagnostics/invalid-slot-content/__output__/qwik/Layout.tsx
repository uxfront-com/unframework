import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  Slot,
  component$,
} from "@qwik.dev/core";

export interface LayoutSlots {
  title$?: QRL<() => JSXOutput>;
}

export const Layout = component$<LayoutSlots & { class?: ClassList; style?: CSSProperties }>(
  ({ title$, class: className, style }) => {
    return (
      <main class={className} style={style}>
        <h1>{title$?.()}</h1>
        <Slot />
      </main>
    );
  },
);
