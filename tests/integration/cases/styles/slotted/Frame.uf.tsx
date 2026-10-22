import "./Frame.css";
import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Frame() {
  const slots = defineSlots<{ default?(): Element; label?(props: { text: string }): Element }>();
  return (
    <figure class="frame">
      {slots.default?.()}
      {slots.label?.({ text: "Harbour at dusk" })}
    </figure>
  );
}
