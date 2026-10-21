import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style }) => {
    return (
      <button type="button" class={["button", className]} style={style}>
        <span class="icon" aria-hidden="true">
          +
        </span>
        {text}
      </button>
    );
  },
);
