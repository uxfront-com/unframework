import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style }) => {
    return (
      <button type="button" class={["base", className]} style={style}>
        {text}
      </button>
    );
  },
);
