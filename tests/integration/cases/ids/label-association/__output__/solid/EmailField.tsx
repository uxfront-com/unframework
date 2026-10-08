import { createUniqueId } from "solid-js";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

export default function EmailField(props: EmailFieldProps) {
  const inputId = `uf-id-${createUniqueId()}`;
  const hintId = `uf-id-${createUniqueId()}`;

  return (
    <div class="email-field">
      <label for={inputId}>{props.label}</label>
      <input id={inputId} name="email" type="email" aria-describedby={hintId} />
      <p id={hintId}>{props.hint}</p>
    </div>
  );
}
