import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  Slot,
  component$,
} from "@qwik.dev/core";

export interface FrameSlots {
  label$?: QRL<(props: { text: string }) => JSXOutput>;
}

export default component$<FrameSlots & { class?: ClassList; style?: CSSProperties }>(
  ({ label$, class: className, style }) => {
    return (
      <figure class={["frame", className]} data-uf-9dc516fd="" style={style}>
        <Slot />
        {label$?.({ text: "Harbour at dusk" })}
      </figure>
    );
  },
);
