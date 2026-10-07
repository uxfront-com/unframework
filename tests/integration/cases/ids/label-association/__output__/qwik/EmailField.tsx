import { component$, useId } from "@qwik.dev/core";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

export default component$<EmailFieldProps>(({ label, hint }) => {
  const inputId = "uf-id-" + useId();
  const hintId = "uf-id-" + useId();

  return (
    <div class="email-field">
      <label for={inputId}>{label}</label>
      <input id={inputId} name="email" type="email" aria-describedby={hintId} />
      <p id={hintId}>{hint}</p>
    </div>
  );
});
