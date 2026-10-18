import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export const Header = component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <header class={["header", className]} style={style}>
        Site
      </header>
    );
  },
);
