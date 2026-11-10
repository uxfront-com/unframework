import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface FieldProps {
  name: string;
  label: string;
}

export default component$<FieldProps & { class?: ClassList; style?: CSSProperties }>(
  ({ name, label, class: className, style, ...attributes }) => {
    return (
      <label {...scopeAttributes(attributes)} class={className} style={style}>
        {label}
        <input name={name} />
      </label>
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
