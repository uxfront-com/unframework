import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Tag(
  props: { label: string } & Omit<ComponentProps<"span">, "label" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label", "class", "style"]);

  return (
    <span
      class={props.class ? `tag ${props.class}` : "tag"}
      style={{ ...{ padding: "2px 6px", color: "rgb(30, 30, 30)" }, ...props.style }}
      {...others}
    >
      {props.label}
    </span>
  );
}
