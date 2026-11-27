import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// A scoped slot rendered once per row.
export default function EachSlot({ items }: { items: string[] }) {
  const slots = defineSlots<{ row?(props: { item: string }): Element }>();
  return (
    <span class="each-slot">
      {items.map((item) => (
        <span key={item} class="each-row">
          {slots.row?.({ item })}
        </span>
      ))}
    </span>
  );
}
