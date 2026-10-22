import { type CSSProperties, type ClassList, Slot, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <div class={["mat", className]} data-uf-09929c4a="" style={style}>
        <Slot />
      </div>
    );
  },
);
