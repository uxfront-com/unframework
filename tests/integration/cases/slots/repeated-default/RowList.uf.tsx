import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// The default slot in each row of a list.
export default function RowList({ label, items }: { label: string; items: string[] }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <ul class="row-list" aria-label={label}>
      {items.map((item) => (
        <li key={item}>
          {item} {slots.default?.()}
        </li>
      ))}
    </ul>
  );
}
