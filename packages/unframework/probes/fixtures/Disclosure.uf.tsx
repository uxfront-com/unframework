import { defineEmits, defineSlots, type Element } from "unframework";

import { useControllableState, useToggle } from "./useToggle.uf.ts";

export interface DisclosureProps {
  summary: string;
  note?: string;
}

// A component that calls composables (ADR-0069).
export default function Disclosure({ summary, note = "" }: DisclosureProps) {
  const emit = defineEmits<{ edit: [note: string] }>();
  const slots = defineSlots<{ default?(): Element }>();
  const { on, label, toggle } = useToggle(false);
  const { current, set } = useControllableState(
    () => note,
    (next) => emit("edit", next),
  );

  return (
    <div>
      <button type="button" aria-expanded={on.value} onClick={toggle}>
        {summary} ({label.value})
      </button>
      {on.value ? slots.default?.() : null}
      <p>{current.value}</p>
      <button type="button" onClick={() => set("")}>
        Clear
      </button>
    </div>
  );
}
