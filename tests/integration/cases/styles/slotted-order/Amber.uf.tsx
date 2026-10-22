import "./Amber.css";
import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Amber() {
  const slots = defineSlots<{ default?(): Element }>();
  return <div class="amber">{slots.default?.()}</div>;
}
