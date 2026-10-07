// UF2009 invalid-emits: Vue's call-signature form of `defineEmits`; unframework declares each
// event as a named tuple, `defineEmits<{ rate: [stars: number] }>()`.
import { defineEmits } from "unframework";

export default function Rating() {
  const emit = defineEmits<{ (event: "rate", stars: number): void }>();

  return (
    <div class="rating" role="group" aria-label="Rating">
      <button type="button">1 star</button>
      <button type="button">2 stars</button>
      <button type="button">3 stars</button>
    </div>
  );
}
