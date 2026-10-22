import "./Mat.css";
import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Mat() {
  const slots = defineSlots<{ default?(): Element }>();
  return <div class="mat">{slots.default?.()}</div>;
}
