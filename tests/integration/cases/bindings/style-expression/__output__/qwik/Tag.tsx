import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface TagProps {
  label: string;
  tone?: string;
}

export default component$<TagProps & { class?: ClassList; style?: CSSProperties }>(
  ({ label, class: className, style, ...attributes }) => {
    return (
      <em
        class={["tag", className]}
        style={{ color: "rgb(120, 30, 30)", padding: "1px 4px", ...style }}
        {...scopeAttributes(attributes)}
      >
        {label}
      </em>
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
