import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// Its root is a `<component is>` over tags: a link with an `href`, and a button without one.
// Each tag renders the default slot, or the label as its fallback, and the named `icon` slot.
export default function Action({ href, label }: { href?: string; label: string }) {
  const slots = defineSlots<{ default?(): Element; icon?(): Element }>();
  return (
    <component is={href ? "a" : "button"} href={href} class="action">
      {slots.icon?.()}
      <span data-slot="label">{slots.default?.() ?? label}</span>
    </component>
  );
}
