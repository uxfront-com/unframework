interface FieldAttributes {
  name: string;
  placeholder?: string;
  autocomplete?: "email" | "username";
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

export default function TextField({ label, inputId, hintText, field, hint }: TextFieldProps) {
  return (
    <div class="text-field">
      <label for={inputId}>{label}</label>
      <input id={inputId} type="text" {...field} />
      <p class="text-field-hint" {...hint}>
        {hintText}
      </p>
    </div>
  );
}
