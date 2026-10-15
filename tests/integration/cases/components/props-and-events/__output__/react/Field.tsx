import type { CSSProperties } from "react";

export interface FieldProps {
  label: string;
  tone?: "info" | "warn";
}

export interface FieldEvents {
  onClear?: (label: string) => void;
}

export interface FieldAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Field({
  label,
  tone = "info",
  onClear,
  className,
  style,
}: FieldProps & FieldEvents & FieldAttributes) {
  return (
    <div className={cx("field", tone, className)} style={style}>
      <span>{label}</span>
      <button type="button" onClick={() => onClear?.(label)}>
        Clear {label}
      </button>
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
