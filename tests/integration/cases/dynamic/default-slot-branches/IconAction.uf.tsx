import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// The default slot in the `icon` slot's fallback inside a `<component is>`.
export default function IconAction({ href, label }: { href?: string; label: string }) {
  const slots = defineSlots<{ default?(): Element; icon?(): Element }>();
  return (
    <component is={href ? "a" : "button"} href={href}>
      {slots.icon?.() ?? <span>{slots.default?.() ?? label}</span>}
    </component>
  );
}
