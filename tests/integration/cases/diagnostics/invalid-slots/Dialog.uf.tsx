// UF2029 invalid-slots: a slot is optional, since a parent may leave it empty, and a slot named
// like a prop would collide with it on the targets that pass slots as props (ADR-0054), as a slot
// named `children` would with the default slot on React, Svelte and Solid.
import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Dialog({ title }: { title: string }) {
  const slots = defineSlots<{ default(): Element; title?(): Element; children?(): Element }>();
  return (
    <div role="dialog" aria-label={title}>
      {slots.default?.()}
      <footer>{slots.children?.()}</footer>
    </div>
  );
}
