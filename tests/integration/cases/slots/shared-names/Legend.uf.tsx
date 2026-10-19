import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Legend({ items, label }: { items: string[]; label: string }) {
  const slots = defineSlots<{
    swatch?(props: { item: string }): Element;
    caption?(props: { item: string }): Element;
  }>();
  return (
    <ul aria-label={label}>
      {items.map((item) => (
        <li key={item}>
          <span>{slots.swatch?.({ item })}</span> <span>{slots.caption?.({ item })}</span>
        </li>
      ))}
    </ul>
  );
}
