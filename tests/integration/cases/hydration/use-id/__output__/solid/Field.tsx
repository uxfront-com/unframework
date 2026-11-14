import { type JSX, createUniqueId } from "solid-js";

export interface FieldProps {
  label: string;
  hint: string;
}

export default function Field(props: FieldProps & { class?: string; style?: JSX.CSSProperties }) {
  const inputId = `uf-id-${createUniqueId()}`;
  const hintId = `uf-id-${createUniqueId()}`;

  return (
    <p
      class={props.class ? `field ${props.class}` : "field"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <label for={inputId}>{props.label}</label>
      <input id={inputId} type="text" aria-describedby={hintId} />
      <small id={hintId}>{props.hint}</small>
    </p>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
