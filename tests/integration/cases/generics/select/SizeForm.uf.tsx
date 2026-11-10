import { ref } from "unframework";

import Select from "./Select.uf.tsx";

type Size = "s" | "m" | "l";

// The harness parent (ADR-0057): it binds the generic model to a state of its own type.
export default function SizeForm() {
  const sizes: Size[] = ["s", "m", "l"];
  const size = ref<Size>("m");
  return (
    <section aria-label="Size">
      <Select label="Size" options={sizes} v-model:value={size.value} />
      <output>Chosen: {size.value}</output>
    </section>
  );
}
