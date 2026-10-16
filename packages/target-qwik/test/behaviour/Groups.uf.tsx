import { defineSlots } from "unframework";
import type { Element } from "unframework";

// A scoped slot that FillLists (./FillLists.uf.tsx) fills.
export default function Groups({ items }: { items: string[] }) {
  const slots = defineSlots<{ group?(props: { items: string[] }): Element }>();
  return <div>{slots.group?.({ items })}</div>;
}
