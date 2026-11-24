import { styleProperties } from "./_unframework/styleProperties";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

interface HintAttributes {
  id: string;
  style?: string;
}

export interface HintProps {
  text: string;
  attrs: HintAttributes;
}

export default function Hint(
  props: HintProps &
    Omit<ComponentProps<"small">, "text" | "attrs" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["text", "attrs", "style"]);

  return (
    <small
      id={props.attrs.id}
      style={{ ...styleProperties(props.attrs.style), ...props.style }}
      {...others}
    >
      {props.text}
    </small>
  );
}
