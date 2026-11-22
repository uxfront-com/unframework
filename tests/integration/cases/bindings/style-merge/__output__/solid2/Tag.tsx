import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
}

export default function Tag(
  props: TagProps &
    Omit<ComponentProps<"span">, "label" | "colour" | "weight" | "indent" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "colour", "weight", "indent", "class", "style");

  return (
    <span
      class={props.class ? `tag ${props.class}` : "tag"}
      style={{
        ...{
          display: "inline-block",
          padding: "2px 8px",
          "border-style": "solid",
          "border-width": "1px",
          "border-color": props.colour ?? "#5a5a5a",
          color: props.colour,
          "font-weight": props.weight,
          "margin-left": props.indent,
        },
        ...props.style,
      }}
      {...others}
    >
      {props.label}
    </span>
  );
}
