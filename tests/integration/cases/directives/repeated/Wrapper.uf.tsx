import { defineSlots } from "@uxfront/unframework";
import type { Element } from "@uxfront/unframework";

import Rows from "./Rows.uf.tsx";

// A wrapper that forwards its `row` slot to a child of another file, which renders it per item.
export default function Wrapper() {
  const slots = defineSlots<{ row?(): Element }>();

  return (
    <section class="wrapper" aria-label="Rows">
      <Rows>{{ row: slots.row }}</Rows>
    </section>
  );
}
