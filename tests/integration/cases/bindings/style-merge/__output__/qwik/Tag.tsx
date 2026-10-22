import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
}

export default component$<TagProps & { class?: ClassList; style?: CSSProperties }>(
  ({ label, colour, weight, indent, class: className, style, ...attributes }) => {
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
        {...scopeAttributes(attributes)}
      >
        {label}
      </span>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
