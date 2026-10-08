import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Card({ label }: { label: string }) {
  const slots = defineSlots<{ title?(): Element; default?(): Element }>();
  return (
    <section class="card" aria-label={label}>
      {slots.title ? <header class="title">{slots.title?.()}</header> : null}
      {slots.default ? <div class="body">{slots.default?.()}</div> : <p>Empty card</p>}
    </section>
  );
}
