import Box from "./Box";
import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface FrameSlots {
  title$?: QRL<() => JSXOutput>;
}

export default component$<
  { label: string } & FrameSlots &
    Omit<PropsOf<"section">, "label" | "title$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, title$, class: className, style, ...attributes }) => {
  return (
    <section class={["frame", className]} aria-label={label} style={style} {...attributes}>
      <Box title$={title$} />
    </section>
  );
});
