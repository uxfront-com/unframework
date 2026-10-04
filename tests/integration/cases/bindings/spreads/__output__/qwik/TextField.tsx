import { component$ } from "@qwik.dev/core";

interface FieldAttributes {
  name: string;
  placeholder?: string;
  autocomplete?: string;
  maxlength?: number;
  required?: boolean;
  title?: string;
}

interface HintAttributes {
  id: string;
  title?: string;
}

export interface TextFieldProps {
  label: string;
  inputId: string;
  hintText: string;
  field: FieldAttributes;
  hint?: HintAttributes;
}

export default component$<TextFieldProps>(({ label, inputId, hintText, field, hint }) => {
  return (
    <div class="text-field">
      <label for={inputId}>{label}</label>
      <input
        id={inputId}
        type="text"
        name={field.name}
        placeholder={field.placeholder}
        autocomplete={field.autocomplete}
        maxLength={field.maxlength}
        required={field.required}
        title={field.title}
      />
      <p class="text-field-hint" id={hint?.id} title={hint?.title}>
        {hintText}
      </p>
    </div>
  );
});
