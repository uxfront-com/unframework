import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Card() {
  const slots = defineSlots<{ header?(): Element; default?(): Element; footer?(): Element }>();
  return (
    <article class="card">
      <header>{slots.header?.()}</header>
      <div class="body">{slots.default?.()}</div>
      <footer>{slots.footer?.()}</footer>
    </article>
  );
}
