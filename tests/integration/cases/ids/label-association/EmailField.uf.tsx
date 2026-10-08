import { useId } from "unframework";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

export default function EmailField({ label, hint }: EmailFieldProps) {
  const inputId = useId();
  const hintId = useId();

  return (
    <div class="email-field">
      <label for={inputId}>{label}</label>
      <input id={inputId} name="email" type="email" aria-describedby={hintId} />
      <p id={hintId}>{hint}</p>
    </div>
  );
}
