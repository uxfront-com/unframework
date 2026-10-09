import { defineModel } from "unframework";

export default function PriceRange({ label }: { label: string }) {
  const min = defineModel<number>("min", { default: 0 });
  const max = defineModel<number>("max", { default: 100 });
  function widen() {
    min.value -= 10;
    max.value += 10;
  }
  return (
    <fieldset>
      <legend>{label}</legend>
      <p>
        From {min.value} to {max.value}
      </p>
      <button type="button" onClick={widen}>
        Widen
      </button>
    </fieldset>
  );
}
