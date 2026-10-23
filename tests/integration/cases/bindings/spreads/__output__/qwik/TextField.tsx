import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

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

export default component$<TextFieldProps & { class?: ClassList; style?: CSSProperties }>(
  ({ label, inputId, hintText, field, hint, class: className, style, ...attributes }) => {
    return (
      <div class={["text-field", className]} {...scopeAttributes(attributes)} style={style}>
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
