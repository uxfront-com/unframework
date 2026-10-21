import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style }) => {
    return (
      <p class={["hint", className]} style={style}>
        Tip: <span class="uf-highlight">{text}</span>
      </p>
    );
  },
);
