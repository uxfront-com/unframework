import { type ComponentProps, type JSX, splitProps } from "solid-js";
import "virtual:styleframe.css";

export default function Note(
  props: { text: string } & Omit<ComponentProps<"p">, "text" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["text", "class"]);

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
