import Box from "./Box";
import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface FrameSlots {
  title$?: QRL<() => JSXOutput>;
}

export default component$<
  { label: string } & FrameSlots & { class?: ClassList; style?: CSSProperties }
>(({ label, title$, class: className, style }) => {
  return (
    <section class={["frame", className]} aria-label={label} style={style}>
      <Box title$={title$} />
    </section>
  );
});
