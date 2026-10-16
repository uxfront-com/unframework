import { type CSSProperties, type ClassList, component$, useId } from "@qwik.dev/core";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

export default component$<EmailFieldProps & { class?: ClassList; style?: CSSProperties }>(
  ({ label, hint, class: className, style }) => {
    const inputId = "uf-id-" + useId();
    const hintId = "uf-id-" + useId();

    return (
      <div class={["email-field", className]} style={style}>
        <label for={inputId}>{label}</label>
        <input id={inputId} name="email" type="email" aria-describedby={hintId} />
        <p id={hintId}>{hint}</p>
      </div>
    );
  },
);
