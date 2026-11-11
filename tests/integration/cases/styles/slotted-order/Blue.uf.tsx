import "./Blue.css";
import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

export default function Blue() {
  const slots = defineSlots<{ default?(): Element }>();
  return <div class="blue">{slots.default?.()}</div>;
}
