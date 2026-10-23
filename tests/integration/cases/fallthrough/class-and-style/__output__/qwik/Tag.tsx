import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ label: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ label, class: className, style, ...attributes }) => {
    return (
      <span
        class={["tag", className]}
        style={{ padding: "2px 6px", color: "rgb(30, 30, 30)", ...style }}
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
