import { ref } from "unframework";

import { useTotal } from "./useTotal.uf.ts";

export default function Basket({ price }: { price: number }) {
  const quantity = ref(1);
  const { total, label } = useTotal(
    () => price,
    () => quantity.value,
  );

  return (
    <section class="basket" aria-label="Basket">
      <p role="status">Total: {total.value}</p>
      <p>{label.value}</p>
      <button type="button" onClick={() => quantity.value++}>
        Add one
      </button>
    </section>
  );
}
