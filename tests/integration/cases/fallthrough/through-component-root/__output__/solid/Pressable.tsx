import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Pressable(
  props: { text: string } & Omit<ComponentProps<"button">, "text" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["text", "class"]);

  return (
    <button
      type="button"
      class={props.class ? `pressable ${props.class}` : "pressable"}
      {...others}
    >
      {props.text}
    </button>
  );
}
