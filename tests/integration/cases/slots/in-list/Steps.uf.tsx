import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

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
