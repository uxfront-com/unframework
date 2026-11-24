import { styleProperties } from "./_unframework/styleProperties";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

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
    Omit<ComponentProps<"small">, "text" | "attrs" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "text", "attrs", "style");

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
