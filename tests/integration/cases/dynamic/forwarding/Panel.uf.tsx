import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Panel() {
  const slots = defineSlots<{ title?(): Element }>();
  return (
    <div class="panel">
      <h4>{slots.title?.() ?? "Untitled"}</h4>
    </div>
  );
}
