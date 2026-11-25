import "./Mat.css";
import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

export default function Mat() {
  const slots = defineSlots<{ default?(): Element }>();
  return <div class="mat">{slots.default?.()}</div>;
}
