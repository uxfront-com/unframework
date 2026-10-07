import { useId } from "react";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

export default function EmailField({ label, hint }: EmailFieldProps) {
  const inputId = `uf-id-${useId()}`;
  const hintId = `uf-id-${useId()}`;

  return (
    <div className="email-field">
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} name="email" type="email" aria-describedby={hintId} />
      <p id={hintId}>{hint}</p>
    </div>
  );
}
