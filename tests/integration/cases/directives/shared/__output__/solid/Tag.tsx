import { vMark } from "./vMark";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface TagProps {
  name: string;
}

export default function Tag(
  props: TagProps & Omit<ComponentProps<"em">, "name" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["name", "class"]);

  return (
    <em
      class={props.class ? `tag ${props.class}` : "tag"}
      ref={vMark(() => `tag ${props.name}`)}
      {...others}
    >
      #{props.name}
    </em>
  );
}
