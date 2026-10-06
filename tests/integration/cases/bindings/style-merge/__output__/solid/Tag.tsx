export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
}

export default function Tag(props: TagProps) {
  return (
    <span
      class="tag"
      style={{
        display: "inline-block",
        padding: "2px 8px",
        "border-style": "solid",
        "border-width": "1px",
        "border-color": props.colour ?? "#5a5a5a",
        color: props.colour,
        "font-weight": props.weight,
        "margin-left": props.indent,
      }}
    >
      {props.label}
    </span>
  );
}
