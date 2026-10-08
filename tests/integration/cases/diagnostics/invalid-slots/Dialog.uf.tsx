// UF2029 invalid-slots: a slot is optional, since a parent may leave it empty, and a slot named
// like a prop would collide with it on the targets that pass slots as props (ADR-0054).
import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Dialog({ title }: { title: string }) {
  const slots = defineSlots<{ default(): Element; title?(): Element }>();
  return (
    <div role="dialog" aria-label={title}>
      {slots.default?.()}
    </div>
  );
}
