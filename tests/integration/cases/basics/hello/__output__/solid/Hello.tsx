import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Hello(
  props: Omit<ComponentProps<"p">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  return (
    <p class={props.class ? `greeting ${props.class}` : "greeting"} {...others}>
      Hello, world!
    </p>
  );
}
