import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export const Card = component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <p class={className} style={style}>
        Card
      </p>
    );
  },
);
