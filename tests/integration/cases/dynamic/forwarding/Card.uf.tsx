import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Card() {
  const slots = defineSlots<{ title?(): Element }>();
  return (
    <div class="card">
      <h3>{slots.title?.() ?? "Untitled"}</h3>
    </div>
  );
}
