import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<BadgeProps & { class?: ClassList; style?: CSSProperties }>(
  ({ label, tone = "info", class: className, style, ...attributes }) => {
    return (
      <span
        class={[`badge badge-${tone}`, className]}
        {...scopeAttributes(attributes)}
        style={style}
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
