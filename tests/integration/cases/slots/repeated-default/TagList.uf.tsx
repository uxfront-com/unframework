import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// The default slot under a list inside a `<component is>`, with a fallback that reads the row.
export default function TagList({
  ordered,
  label,
  items,
}: {
  ordered: boolean;
  label: string;
  items: string[];
}) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <component is={ordered ? "ol" : "ul"} class="tag-list" aria-label={label}>
      {items.map((item) => (
        <li key={item}>{slots.default?.() ?? item}</li>
      ))}
    </component>
  );
}
