import { ref } from "unframework";

import Card from "./Card.uf.tsx";
import Chip from "./Chip.uf.tsx";

export default function Tag({ label }: { label: string }) {
  const compact = ref(true);
  return (
    <section aria-label="Tag">
      <component is={compact.value ? Chip : Card} label={label} />
      <button type="button" onClick={() => (compact.value = !compact.value)}>
        {compact.value ? "Expand" : "Compact"}
      </button>
    </section>
  );
}
