import Rows from "./Rows";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface WrapperSlots {
  row?: JSX.Element;
}

export default function Wrapper(
  props: WrapperSlots &
    Omit<ComponentProps<"section">, "row" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "row", "class");

  return (
    <section
      class={props.class ? `wrapper ${props.class}` : "wrapper"}
      aria-label="Rows"
      {...others}
    >
      <Rows row={props.row} />
    </section>
  );
}
