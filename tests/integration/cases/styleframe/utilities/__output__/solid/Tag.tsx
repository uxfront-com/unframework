import { type ComponentProps, type JSX, splitProps } from "solid-js";
import "virtual:styleframe.css";

export default function Tag(
  props: { label: string } & Omit<ComponentProps<"span">, "label" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label", "class"]);

  return (
    <span
      class={
        props.class
          ? `_padding:lg _background-color:primary _color:on-primary _border-radius:[4px] ${props.class}`
          : "_padding:lg _background-color:primary _color:on-primary _border-radius:[4px]"
      }
      {...others}
    >
      {props.label}
    </span>
  );
}
