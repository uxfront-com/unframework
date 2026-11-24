import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface TagProps {
  label: string;
  tone?: string;
}

export default function Tag(
  props: TagProps &
    Omit<ComponentProps<"em">, "label" | "tone" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["label", "tone", "class", "style"]);

  return (
    <em
      class={props.class ? `tag ${props.class}` : "tag"}
      style={{ ...{ color: "rgb(120, 30, 30)", padding: "1px 4px" }, ...props.style }}
      {...others}
    >
      {props.label}
    </em>
  );
}
