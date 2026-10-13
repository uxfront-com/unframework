import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <p class={["greeting", className]} style={style}>
        Hello, world!
      </p>
    );
  },
);
