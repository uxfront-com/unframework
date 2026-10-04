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

export default function TextField({ label, inputId, hintText, field, hint }: TextFieldProps) {
  return (
    <div className="text-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="text"
        name={field.name}
        placeholder={field.placeholder}
        autoComplete={field.autocomplete}
        maxLength={field.maxlength}
        required={field.required}
        title={field.title}
      />
      <p className="text-field-hint" id={hint?.id} title={hint?.title}>
        {hintText}
      </p>
    </div>
  );
}
