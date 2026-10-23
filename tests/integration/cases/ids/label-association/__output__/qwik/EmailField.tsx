import { type CSSProperties, type ClassList, component$, useId } from "@qwik.dev/core";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

export default component$<EmailFieldProps & { class?: ClassList; style?: CSSProperties }>(
  ({ label, hint, class: className, style, ...attributes }) => {
    const inputId = "uf-id-" + useId();
    const hintId = "uf-id-" + useId();

    return (
      <div class={["email-field", className]} {...scopeAttributes(attributes)} style={style}>
        <label for={inputId}>{label}</label>
        <input id={inputId} name="email" type="email" aria-describedby={hintId} />
        <p id={hintId}>{hint}</p>
      </div>
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
