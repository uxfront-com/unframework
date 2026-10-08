import { defineEmits } from "unframework";

export interface FieldProps {
  label: string;
  tone?: "info" | "warn";
}

export default function Field({ label, tone = "info" }: FieldProps) {
  const emit = defineEmits<{ clear: [label: string] }>();
  return (
    <div class={["field", tone]}>
      <span>{label}</span>
      <button type="button" onClick={() => emit("clear", label)}>
        Clear {label}
      </button>
    </div>
  );
}
