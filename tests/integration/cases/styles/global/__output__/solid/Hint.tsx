import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Hint(
  props: { text: string } & Omit<ComponentProps<"p">, "text" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["text", "class"]);

  return (
    <p class={props.class ? `hint ${props.class}` : "hint"} {...others}>
      Tip: <span class="uf-highlight">{props.text}</span>
    </p>
  );
}
