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
    <div class={props.class ? `email-field ${props.class}` : "email-field"} style={props.style}>
      <label for={inputId}>{props.label}</label>
      <input id={inputId} name="email" type="email" aria-describedby={hintId} />
      <p id={hintId}>{props.hint}</p>
    </div>
  );
}
