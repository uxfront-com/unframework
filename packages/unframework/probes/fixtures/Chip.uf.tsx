import { defineEmits } from "unframework";

import type { ChipProps } from "./types.ts";

export default function Chip({ label, tone = "neutral", removable = false }: ChipProps) {
  const emit = defineEmits<{ remove: [] }>();

  return (
    <span class={["chip", `chip--${tone}`]}>
      {label}
      {removable ? (
        <button type="button" aria-label="Remove" onClick={() => emit("remove")}>
          ×
        </button>
      ) : null}
    </span>
  );
}
