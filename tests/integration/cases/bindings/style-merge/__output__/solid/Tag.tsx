import type { JSX } from "solid-js";

export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
}

export default function Tag(props: TagProps & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <span
      class={props.class ? `tag ${props.class}` : "tag"}
      style={{
        ...{
          display: "inline-block",
          padding: "2px 8px",
          "border-style": "solid",
          "border-width": "1px",
          "border-color": props.colour ?? "#5a5a5a",
          color: props.colour,
          "font-weight": props.weight,
          "margin-left": props.indent,
        },
        ...props.style,
      }}
    >
      {props.label}
    </span>
  );
}
