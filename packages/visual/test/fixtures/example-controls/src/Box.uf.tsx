import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

export default function Box() {
  const slots = defineSlots<{ default?(): Element }>();
  return <div data-box>{slots.default?.()}</div>;
}
