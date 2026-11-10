import type { JSX } from "solid-js";

export interface FieldProps {
  name: string;
  label: string;
}

export default function Field(props: FieldProps & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <label class={props.class} style={props.style} {...scopeAttributes(props)}>
      {props.label}
      <input name={props.name} />
    </label>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
