import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
}

export default component$<
  TagProps &
    Omit<PropsOf<"span">, "label" | "colour" | "weight" | "indent" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, colour, weight, indent, class: className, style, ...attributes }) => {
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
      {...attributes}
    >
      {label}
    </span>
  );
});
