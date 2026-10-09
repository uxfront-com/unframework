import { ref } from "unframework";

import PriceRange from "./PriceRange.uf.tsx";

export default function Search() {
  const low = ref(20);
  const high = ref(50);
  return (
    <section aria-label="Search">
      <PriceRange label="Price" v-model:min={low.value} v-model:max={high.value} />
      <output>
        Between {low.value} and {high.value}
      </output>
      <button type="button" onClick={() => (high.value = 40)}>
        Cheaper
      </button>
    </section>
  );
}
