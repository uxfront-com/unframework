import { type CSSProperties, type ClassList, Slot, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <figure class={["frame", className]} data-uf-9dc516fd="" style={style}>
        <Slot />
      </figure>
    );
  },
);
