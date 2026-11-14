import { type CSSProperties, type ClassList, component$, useId } from "@qwik.dev/core";

export interface FieldProps {
  label: string;
  hint: string;
}

export default component$<FieldProps & { class?: ClassList; style?: CSSProperties }>(
  ({ label, hint, class: className, style, ...attributes }) => {
    const inputId = "uf-id-" + useId();
    const hintId = "uf-id-" + useId();

    return (
      <p class={["field", className]} {...scopeAttributes(attributes)} style={style}>
        <label for={inputId}>{label}</label>
        <input id={inputId} type="text" aria-describedby={hintId} />
        <small id={hintId}>{hint}</small>
      </p>
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
