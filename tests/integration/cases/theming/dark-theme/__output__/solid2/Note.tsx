import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "virtual:styleframe.css";

export default function Note(
  props: { text: string } & Omit<ComponentProps<"p">, "text" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "text", "class");

  return (
    <p
      class={
        props.class
          ? `_padding:md _background-color:surface _color:text ${props.class}`
          : "_padding:md _background-color:surface _color:text"
      }
      {...others}
    >
      {props.text}
    </p>
  );
}
