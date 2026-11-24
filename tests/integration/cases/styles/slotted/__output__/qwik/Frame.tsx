import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  Slot,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Frame.uf.tsx.css?inline";

export interface FrameSlots {
  label$?: QRL<(props: { text: string }) => JSXOutput>;
}

export default component$<
  FrameSlots &
    Omit<PropsOf<"figure">, "label$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label$, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <figure class={["frame", className]} data-uf-9dc516fd="" style={style} {...attributes}>
      <Slot />
      {label$?.({ text: "Harbour at dusk" })}
    </figure>
  );
});
