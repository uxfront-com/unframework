import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function TransitionComponent(
  props: Omit<ComponentProps<"p">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  return (
    <p class={props.class ? `note ${props.class}` : "note"} {...others}>
      Plain child
    </p>
  );
}
