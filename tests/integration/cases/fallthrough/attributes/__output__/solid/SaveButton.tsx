import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function SaveButton(
  props: { title: string } & Omit<ComponentProps<"button">, "title" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["title", "class"]);

  return (
    <button type="button" class={props.class ? `button ${props.class}` : "button"} {...others}>
      {props.title}
    </button>
  );
}
