import { vMark } from "./vMark";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface TagProps {
  name: string;
}

export default function Tag(
  props: TagProps &
    Omit<ComponentProps<"em">, "name" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "name", "class");

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
