import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "virtual:styleframe.css";

export default function Tag(
  props: { label: string } & Omit<ComponentProps<"span">, "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "class");

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
