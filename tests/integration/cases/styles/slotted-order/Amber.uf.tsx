import "./Amber.css";
import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

export default function Amber() {
  const slots = defineSlots<{ default?(): Element }>();
  return <div class="amber">{slots.default?.()}</div>;
}
