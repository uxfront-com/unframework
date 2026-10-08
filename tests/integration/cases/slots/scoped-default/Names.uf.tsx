import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Names({ names }: { names: string[] }) {
  const slots = defineSlots<{ default?(props: { item: string }): Element }>();
  return (
    <ul aria-label="Names">
      {names.map((item) => (
        <li key={item}>{slots.default?.({ item })}</li>
      ))}
    </ul>
  );
}
