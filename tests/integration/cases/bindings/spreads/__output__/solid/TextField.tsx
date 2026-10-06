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

export default function TextField(props: TextFieldProps) {
  return (
    <div class="text-field">
      <label for={props.inputId}>{props.label}</label>
      <input
        id={props.inputId}
        type="text"
        name={props.field.name}
        placeholder={props.field.placeholder}
        autocomplete={props.field.autocomplete}
        maxlength={props.field.maxlength}
        required={props.field.required}
        title={props.field.title}
      />
      <p class="text-field-hint" id={props.hint?.id} title={props.hint?.title}>
        {props.hintText}
      </p>
    </div>
  );
}
