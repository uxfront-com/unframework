import { type JSX, createUniqueId } from "solid-js";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

export default function EmailField(
  props: EmailFieldProps & { class?: string; style?: JSX.CSSProperties },
) {
  const inputId = `uf-id-${createUniqueId()}`;
  const hintId = `uf-id-${createUniqueId()}`;

  return (
    <div
      class={props.class ? `email-field ${props.class}` : "email-field"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <label for={inputId}>{props.label}</label>
      <input id={inputId} name="email" type="email" aria-describedby={hintId} />
      <p id={hintId}>{props.hint}</p>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
