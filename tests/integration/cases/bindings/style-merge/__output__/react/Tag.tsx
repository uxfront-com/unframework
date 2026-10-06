export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
}

export default function Tag({ label, colour, weight, indent }: TagProps) {
  return (
    <span
      className="tag"
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderStyle: "solid",
        borderWidth: "1px",
        borderColor: colour ?? "#5a5a5a",
        color: colour,
        fontWeight: weight,
        marginLeft: indent,
      }}
    >
      {label}
    </span>
  );
}
