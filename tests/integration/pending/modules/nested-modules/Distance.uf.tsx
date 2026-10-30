import { ref } from "unframework";

import { formatDistance } from "./format";
import type { Unit } from "./units";

export default function Distance({ value }: { value: number }) {
  const unit = ref<Unit>("km");

  return (
    <section class="distance" aria-label="Distance">
      <p role="status">{formatDistance(value, unit.value)}</p>
      <button type="button" onClick={() => (unit.value = unit.value === "km" ? "mi" : "km")}>
        Switch units
      </button>
    </section>
  );
}
