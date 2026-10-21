import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ text: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ text, class: className, style }) => {
    return (
      <div class={["note-box", className]} style={style}>
        <p class="note">{text}</p>
      </div>
    );
  },
);
