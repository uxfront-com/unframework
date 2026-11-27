import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

import EachSlot from "./EachSlot.uf.tsx";

// The default slot in a scoped fill inside a `<component is>`, of a child that renders the fill
// once per row, with a fallback that reads the row.
export default function EachAction({ href, items }: { href?: string; items: string[] }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <component is={href ? "a" : "button"} href={href}>
      <EachSlot items={items}>
        {{ row: ({ item }) => <span class="each-fill">{slots.default?.() ?? item}</span> }}
      </EachSlot>
    </component>
  );
}
