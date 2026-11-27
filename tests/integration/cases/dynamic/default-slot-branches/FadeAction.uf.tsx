import { Transition, defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// The default slot in a transition's element inside a `<component is>`.
export default function FadeAction({ href, label }: { href?: string; label: string }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <component is={href ? "a" : "button"} href={href}>
      <Transition name="fade">
        <span>{slots.default?.() ?? label}</span>
      </Transition>
    </component>
  );
}
