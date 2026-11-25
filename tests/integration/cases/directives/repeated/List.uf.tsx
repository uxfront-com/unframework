import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// A child that renders its scoped `item` slot once per item.
export default function List({ items }: { items: string[] }) {
  const slots = defineSlots<{ item?(props: { item: string }): Element }>();

  return (
    <ol>
      {items.map((item) => (
        <li key={item}>{slots.item?.({ item })}</li>
      ))}
    </ol>
  );
}
