import "./Frame.css";
import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Frame() {
  const slots = defineSlots<{ default?(): Element }>();
  return <figure class="frame">{slots.default?.()}</figure>;
}
