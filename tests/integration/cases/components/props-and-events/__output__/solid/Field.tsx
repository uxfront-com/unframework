import { mergeProps } from "solid-js";

export interface FieldProps {
  label: string;
  tone?: "info" | "warn";
}

export interface FieldEvents {
  onClear?: (label: string) => void;
}

export default function Field(rawProps: FieldProps & FieldEvents) {
  const props = mergeProps({ tone: "info" } satisfies Partial<FieldProps>, rawProps);
  return (
    <div class={cx("field", props.tone)}>
      <span>{props.label}</span>
      <button type="button" onClick={() => props.onClear?.(props.label)}>
        Clear {props.label}
      </button>
    </div>
  );
}

/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}
