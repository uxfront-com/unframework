import { type CSSProperties, type ClassList, Slot, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <div class={["amber", className]} data-uf-c97301b3="" style={style}>
        <Slot />
      </div>
    );
  },
);
