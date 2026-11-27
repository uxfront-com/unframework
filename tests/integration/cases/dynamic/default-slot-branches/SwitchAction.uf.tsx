import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// The default slot in both branches of a conditional inside a `<component is>`.
export default function SwitchAction({ href }: { href?: string }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <component is={href ? "a" : "button"} href={href}>
      {href ? <b>{slots.default?.()}</b> : <i>{slots.default?.()}</i>}
    </component>
  );
}
