import { type CSSProperties, type ClassList, Slot, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <div class={["blue", className]} data-uf-721c504a="" style={style}>
        <Slot />
      </div>
    );
  },
);
