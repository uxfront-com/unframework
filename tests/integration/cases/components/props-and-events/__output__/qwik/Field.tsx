import { type CSSProperties, type ClassList, type QRL, component$ } from "@qwik.dev/core";

export interface FieldProps {
  label: string;
  tone?: "info" | "warn";
}

export interface FieldEvents {
  onClear$?: QRL<(label: string) => void>;
}

export default component$<FieldProps & FieldEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ label, tone = "info", onClear$, class: className, style, ...attributes }) => {
    return (
      <div class={["field", tone, className]} {...scopeAttributes(attributes)} style={style}>
        <span>{label}</span>
        <button type="button" onClick$={() => onClear$?.(label)}>
          Clear {label}
        </button>
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
