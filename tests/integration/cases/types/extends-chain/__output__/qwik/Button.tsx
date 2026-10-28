import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<ButtonProps & { class?: ClassList; style?: CSSProperties }>(
  ({ id, label, disabled = false, class: className, style, ...attributes }) => {
    return (
      <button
        id={id}
        type="button"
        disabled={disabled}
        {...scopeAttributes(attributes)}
        class={className}
        style={style}
      >
        {label}
      </button>
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
