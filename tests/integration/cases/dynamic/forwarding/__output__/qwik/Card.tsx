import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface CardSlots {
  title$?: QRL<() => JSXOutput>;
}

export default component$<CardSlots & { class?: ClassList; style?: CSSProperties }>(
  ({ title$, class: className, style }) => {
    return (
      <div class={["card", className]} style={style}>
        <h3>{title$?.() ?? "Untitled"}</h3>
      </div>
    );
  },
);
