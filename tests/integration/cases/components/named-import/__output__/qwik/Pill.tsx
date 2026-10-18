import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export const Pill = component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style }) => {
    return (
      <span class={["pill", className]} style={style}>
        {text}
      </span>
    );
  },
);
