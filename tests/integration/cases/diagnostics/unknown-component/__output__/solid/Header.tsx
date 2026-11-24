import { type ComponentProps, type JSX, splitProps } from "solid-js";

export function Header(
  props: Omit<ComponentProps<"header">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  return (
    <header class={props.class ? `header ${props.class}` : "header"} {...others}>
      Site
    </header>
  );
}
