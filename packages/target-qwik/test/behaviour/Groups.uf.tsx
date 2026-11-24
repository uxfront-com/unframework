import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// A scoped slot that FillLists (./FillLists.uf.tsx) fills.
export default function Groups({ items }: { items: Array<string> }) {
  const slots = defineSlots<{ group?(props: { items: Array<string> }): Element }>();
  return <div>{slots.group?.({ items })}</div>;
}
