import { defineSlots } from "unframework";
import type { Element } from "unframework";

import Box from "./Box.uf.tsx";

export default function Frame({ label }: { label: string }) {
  const slots = defineSlots<{ title?(): Element; default?(): Element }>();
  return (
    <section class="frame" aria-label={label}>
      <Box>{{ title: slots.title, default: slots.default }}</Box>
    </section>
  );
}
