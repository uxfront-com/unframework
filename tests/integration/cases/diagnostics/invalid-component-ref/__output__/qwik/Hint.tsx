import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export const Hint = component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style }) => {
    return (
      <small class={["hint", className]} style={style}>
        {text}
      </small>
    );
  },
);
