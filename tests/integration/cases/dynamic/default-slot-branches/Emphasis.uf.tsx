import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

// The default slot in both branches of a conditional, with no `<component is>`.
export default function Emphasis({ strong }: { strong: boolean }) {
  const slots = defineSlots<{ default?(): Element }>();
  return <p class="emphasis">{strong ? <b>{slots.default?.()}</b> : <i>{slots.default?.()}</i>}</p>;
}
