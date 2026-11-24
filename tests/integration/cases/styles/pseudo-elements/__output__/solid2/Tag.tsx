import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Tag.uf.tsx.css";

export default function Tag(
  props: { name: string } & Omit<ComponentProps<"span">, "name" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "name", "class");

  return (
    <span class={props.class ? `tag ${props.class}` : "tag"} data-uf-ef5e671c="" {...others}>
      {props.name}
    </span>
  );
}
