import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Panel({ title }: { title: string }) {
  const slots = defineSlots<{ default?(): Element }>();
  return (
    <section class="panel" aria-label={title}>
      <h2>{title}</h2>
      {slots.default?.()}
    </section>
  );
}
