import { defineEmits } from "unframework";

import { useControllableState } from "./useControllableState.uf.ts";

export default function Rating({ value }: { value?: number }) {
  const emit = defineEmits<{ change: [value: number] }>();
  const { current, set } = useControllableState(
    () => value,
    1,
    (next) => emit("change", next),
  );

  return (
    <section class="rating" aria-label="Rating">
      <p role="status">Rated {current.value} of 3</p>
      <button type="button" onClick={() => set(2)}>
        Two
      </button>
      <button type="button" onClick={() => set(3)}>
        Three
      </button>
    </section>
  );
}
