import { type ComponentProps, type JSX, splitProps } from "solid-js";
import "./Tag.uf.tsx.css";

export default function Tag(
  props: { name: string } & Omit<ComponentProps<"span">, "name" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["name", "class"]);

  return (
    <span class={props.class ? `tag ${props.class}` : "tag"} data-uf-ef5e671c="" {...others}>
      {props.name}
    </span>
  );
}
