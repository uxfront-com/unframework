import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Item(
  props: { label: string } & Omit<ComponentProps<"li">, "label" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label", "class"]);

  return (
    <li class={props.class ? `item ${props.class}` : "item"} {...others}>
      {props.label}
    </li>
  );
}
