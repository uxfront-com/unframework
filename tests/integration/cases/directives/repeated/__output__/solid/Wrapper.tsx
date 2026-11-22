import Rows from "./Rows";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface WrapperSlots {
  row?: JSX.Element;
}

export default function Wrapper(
  props: WrapperSlots &
    Omit<ComponentProps<"section">, "row" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["row", "class"]);

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
