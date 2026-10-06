import { component$ } from "@qwik.dev/core";

export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
}

export default component$<TagProps>(({ label, colour, weight, indent }) => {
  return (
    <span
      class="tag"
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
});
