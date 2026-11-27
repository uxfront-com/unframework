import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// The default slot under a conditional inside a `<component is>`: its fallback reads the label
// the condition tests.
export default function LabelAction({ href, label }: { href?: string; label: string }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <component is={href ? "a" : "button"} href={href}>
      {label ? <span>{slots.default?.() ?? label}</span> : null}
    </component>
  );
}
