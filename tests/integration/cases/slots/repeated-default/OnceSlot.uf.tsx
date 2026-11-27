import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// A scoped slot rendered once.
export default function OnceSlot({ label }: { label: string }) {
  const slots = defineSlots<{ text?(props: { label: string }): Element }>();
  return <span class="once-slot">{slots.text?.({ label })}</span>;
}
