// UF2028 invalid-model: `defineModel` takes the model's name, which every target names the
// model's prop after; the safe fix names a nameless model `"value"`.
import { defineModel } from "unframework";

export default function Rating() {
  const stars = defineModel<number>({ default: 3 });
  return (
    <button type="button" onClick={() => (stars.value += 1)}>
      {stars.value} stars
    </button>
  );
}
