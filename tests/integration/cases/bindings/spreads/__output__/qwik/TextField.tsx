import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

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

export default component$<
  TextFieldProps &
    Omit<
      PropsOf<"div">,
      "label" | "inputId" | "hintText" | "field" | "hint" | "class" | "style"
    > & { class?: ClassList; style?: CSSProperties }
>(({ label, inputId, hintText, field, hint, class: className, style, ...attributes }) => {
  return (
    <div class={["text-field", className]} style={style} {...attributes}>
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
