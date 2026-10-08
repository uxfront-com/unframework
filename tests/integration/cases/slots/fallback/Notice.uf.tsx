import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Notice({ label }: { label: string }) {
  const slots = defineSlots<{ default?(): Element; action?(): Element }>();
  return (
    <div role="note" aria-label={label} class="notice">
      <p>{slots.default?.() ?? <em>Nothing to report.</em>}</p>
      {slots.action?.() ?? <span class="muted">No action</span>}
    </div>
  );
}
