import { type CSSProperties, useId } from "react";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

export interface EmailFieldAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function EmailField({
  label,
  hint,
  className,
  style,
}: EmailFieldProps & EmailFieldAttributes) {
  const inputId = `uf-id-${useId()}`;
  const hintId = `uf-id-${useId()}`;

  return (
    <div className={cx("email-field", className)} style={style}>
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} name="email" type="email" aria-describedby={hintId} />
      <p id={hintId}>{hint}</p>
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
