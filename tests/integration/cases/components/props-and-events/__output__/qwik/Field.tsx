import { type CSSProperties, type ClassList, type QRL, component$ } from "@qwik.dev/core";

export interface FieldProps {
  label: string;
  tone?: "info" | "warn";
}

export interface FieldEvents {
  onClear$?: QRL<(label: string) => void>;
}

export default component$<FieldProps & FieldEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ label, tone = "info", onClear$, class: className, style }) => {
    return (
      <div class={["field", tone, className]} style={style}>
        <span>{label}</span>
        <button type="button" onClick$={() => onClear$?.(label)}>
          Clear {label}
        </button>
      </div>
    );
  },
);
