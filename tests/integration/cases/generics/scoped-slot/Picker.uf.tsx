import { defineSlots } from "unframework";
import type { Element } from "unframework";

// A scoped slot whose props name the type parameter (ADR-0068): a consumer's fill reads `T`.
export interface PickerProps<T> {
  items: T[];
}

export default function Picker<T>({ items }: PickerProps<T>) {
  const slots = defineSlots<{ item?(props: { item: T }): Element }>();
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>{slots.item?.({ item })}</li>
      ))}
    </ul>
  );
}
