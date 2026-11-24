import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Button(
  props: { text: string } & Omit<ComponentProps<"button">, "text" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["text", "class"]);

  return (
    <button type="button" class={props.class ? `button ${props.class}` : "button"} {...others}>
      <span class="icon" aria-hidden="true">
        +
      </span>
      {props.text}
    </button>
  );
}
