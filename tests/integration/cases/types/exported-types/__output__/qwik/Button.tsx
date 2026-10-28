import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export type ButtonTone = "primary" | "secondary";

export interface ButtonProps {
  label: string;
  tone?: ButtonTone;
}

export default component$<ButtonProps & { class?: ClassList; style?: CSSProperties }>(
  ({ label, tone = "primary", class: className, style, ...attributes }) => {
    return (
      <button
        type="button"
        class={[`button button-${tone}`, className]}
        {...scopeAttributes(attributes)}
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
