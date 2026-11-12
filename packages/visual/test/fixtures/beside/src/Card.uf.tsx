import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

export default function Card() {
  const slots = defineSlots<{ default?(): Element }>();
  return <article class="card">{slots.default?.()}</article>;
}
