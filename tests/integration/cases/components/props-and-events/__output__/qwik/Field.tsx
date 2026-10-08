import { type QRL, component$ } from "@qwik.dev/core";

export interface FieldProps {
  label: string;
  tone?: "info" | "warn";
}

export interface FieldEvents {
  onClear$?: QRL<(label: string) => void>;
}

export default component$<FieldProps & FieldEvents>(({ label, tone = "info", onClear$ }) => {
  return (
    <div class={["field", tone]}>
      <span>{label}</span>
      <button type="button" onClick$={() => onClear$?.(label)}>
        Clear {label}
      </button>
    </div>
  );
});
