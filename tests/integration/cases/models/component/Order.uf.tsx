import { ref } from "unframework";

import Stepper from "./Stepper.uf.tsx";

export default function Order() {
  const cups = ref(2);
  return (
    <section aria-label="Order">
      <Stepper label="Cups" v-model:value={cups.value} />
      <output>Ordered: {cups.value}</output>
      <button type="button" onClick={() => (cups.value = 0)}>
        Clear
      </button>
    </section>
  );
}
