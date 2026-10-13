import type { CSSProperties } from "react";

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

export interface TextFieldAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function TextField({
  label,
  inputId,
  hintText,
  field,
  hint,
  className,
  style,
}: TextFieldProps & TextFieldAttributes) {
  return (
    <div className={cx("text-field", className)} style={style}>
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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
