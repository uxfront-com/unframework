import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Card(
  props: { label: string } & Omit<ComponentProps<"div">, "label" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label", "class"]);

  return (
    <div class={props.class ? `card ${props.class}` : "card"} {...others}>
      <strong>{props.label}</strong>
    </div>
  );
}
