import Rows from "./Rows";
import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type PropsOf,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface WrapperSlots {
  row$?: QRL<() => JSXOutput>;
}

export default component$<
  WrapperSlots &
    Omit<PropsOf<"section">, "row$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ row$, class: className, style, ...attributes }) => {
  return (
    <section class={["wrapper", className]} aria-label="Rows" style={style} {...attributes}>
      <Rows row$={row$} />
    </section>
  );
});
