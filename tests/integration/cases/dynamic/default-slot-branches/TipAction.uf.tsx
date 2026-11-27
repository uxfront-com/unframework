import { Teleport, defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// The default slot in a teleport inside a `<component is>`: the tip mounts in the body.
export default function TipAction({ href, label }: { href?: string; label: string }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <component is={href ? "a" : "button"} href={href}>
      {label}
      <Teleport to="body">
        <p data-teleported class="tip" role="note">
          {slots.default?.() ?? label}
        </p>
      </Teleport>
    </component>
  );
}
