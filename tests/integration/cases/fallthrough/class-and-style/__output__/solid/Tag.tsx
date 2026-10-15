import type { JSX } from "solid-js";

export default function Tag(
  props: { label: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <span
      class={props.class ? `tag ${props.class}` : "tag"}
      style={{ ...{ padding: "2px 6px", color: "rgb(30, 30, 30)" }, ...props.style }}
    >
      {props.label}
    </span>
  );
}
