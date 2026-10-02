import { defineEmits, defineSlots, type Element } from "unframework";

export interface Item {
  id: string;
  name: string;
}

export interface ListProps {
  items: Item[];
}

export default function List({ items }: ListProps) {
  const emit = defineEmits<{ select: [item: Item, index: number]; clear: [] }>();
  const slots = defineSlots<{
    item?(props: { item: Item; index: number }): Element;
    empty?(): Element;
  }>();

  return (
    <ul>
      {items.length === 0 ? <li>{slots.empty?.() ?? "Nothing here"}</li> : null}
      {items.map((item, index) => (
        <li key={item.id} onClick={() => emit("select", item, index)}>
          {slots.item?.({ item, index }) ?? item.name}
        </li>
      ))}
      <li>
        <button type="button" onClick={() => emit("clear")}>
          Clear
        </button>
      </li>
    </ul>
  );
}
