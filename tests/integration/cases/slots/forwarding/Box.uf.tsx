import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Box() {
  const slots = defineSlots<{ title?(): Element; default?(): Element }>();
  return (
    <div class="box">
      <h3>{slots.title?.() ?? "Untitled"}</h3>
      {slots.default?.() ?? <p>No content</p>}
    </div>
  );
}
