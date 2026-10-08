import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function List({ items, label }: { items: string[]; label: string }) {
  const slots = defineSlots<{ item?(props: { item: string; index: number }): Element }>();
  return (
    <ul aria-label={label}>
      {items.map((item, index) => (
        <li key={item}>{slots.item?.({ item, index })}</li>
      ))}
    </ul>
  );
}
