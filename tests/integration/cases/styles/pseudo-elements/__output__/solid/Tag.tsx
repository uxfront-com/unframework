import type { JSX } from "solid-js";

export default function Tag(
  props: { name: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <span
      class={props.class ? `tag ${props.class}` : "tag"}
      data-uf-ef5e671c=""
      style={props.style}
    >
      {props.name}
    </span>
  );
}
