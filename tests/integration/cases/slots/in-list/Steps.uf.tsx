import { defineSlots } from "unframework";
import type { Element } from "unframework";

export default function Steps({ steps }: { steps: string[] }) {
  const slots = defineSlots<{ marker?(): Element }>();
  return (
    <ol class="steps">
      {steps.map((step) => (
        <li key={step}>
          {slots.marker?.()}
          {step}
        </li>
      ))}
    </ol>
  );
}
