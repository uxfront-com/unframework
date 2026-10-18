import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
}

export default component$<TagProps & { class?: ClassList; style?: CSSProperties }>(
  ({ label, colour, weight, indent, class: className, style }) => {
    return (
      <span
        class={["tag", className]}
        style={{
          display: "inline-block",
          padding: "2px 8px",
          borderStyle: "solid",
          borderWidth: "1px",
          borderColor: colour ?? "#5a5a5a",
          color: colour,
          fontWeight: weight,
          marginLeft: indent,
          ...style,
        }}
      >
        {label}
      </span>
    );
  },
);
