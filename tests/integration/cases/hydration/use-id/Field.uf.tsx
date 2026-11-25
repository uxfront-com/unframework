import { useId } from "@uxfront/unframework";

export interface FieldProps {
  label: string;
  hint: string;
}

// Two ids from one call each: the label's `for` and the hint's `aria-describedby`.
export default function Field({ label, hint }: FieldProps) {
  const inputId = useId();
  const hintId = useId();

  return (
    <p class="field">
      <label for={inputId}>{label}</label>
      <input id={inputId} type="text" aria-describedby={hintId} />
      <small id={hintId}>{hint}</small>
    </p>
  );
}
