import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style }) => {
    return (
      <h3 class={["heading", className]} style={style}>
        {text}
      </h3>
    );
  },
);
