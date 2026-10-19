import { defineSlots } from "unframework";
import type { Element } from "unframework";

import Card from "./Card.uf.tsx";
import Panel from "./Panel.uf.tsx";

export default function Frame({ label, wide }: { label: string; wide: boolean }) {
  const slots = defineSlots<{ title?(): Element }>();
  return (
    <section class="frame" aria-label={label}>
      <component is={wide ? Panel : Card}>{{ title: slots.title }}</component>
    </section>
  );
}
