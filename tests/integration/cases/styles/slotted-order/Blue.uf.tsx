import "./Blue.css";
import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Blue() {
  const slots = defineSlots<{ default?(): Element }>();
  return <div class="blue">{slots.default?.()}</div>;
}
