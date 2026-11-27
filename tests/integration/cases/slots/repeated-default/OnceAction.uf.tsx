import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

import OnceSlot from "./OnceSlot.uf.tsx";

// The default slot in a scoped fill inside a `<component is>`, of a child that renders the fill
// once, with a fallback that reads the fill's props.
export default function OnceAction({ href, label }: { href?: string; label: string }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <component is={href ? "a" : "button"} href={href}>
      <OnceSlot label={label}>
        {{ text: (shown) => <span class="once-fill">{slots.default?.() ?? shown.label}</span> }}
      </OnceSlot>
    </component>
  );
}
