import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export const Badge = component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style }) => {
    return (
      <span class={["badge", className]} style={style}>
        {text}
      </span>
    );
  },
);
