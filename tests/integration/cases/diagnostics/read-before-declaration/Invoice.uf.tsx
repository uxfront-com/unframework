// UF2023 read-before-declaration: `total` reads `tax`, which is declared after it; a getter runs
// with the setup on some targets (React's `useMemo`), before `tax` exists. Declare `tax` first.
import { computed, ref } from "unframework";

export default function Invoice() {
  const net = ref(100);
  const total = computed(() => net.value + tax.value);
  const tax = computed(() => net.value * 0.2);

  return (
    <section class="invoice" aria-label="Invoice">
      <p>Total: {total.value}</p>
      <button type="button" onClick={() => (net.value += 100)}>
        Add an item
      </button>
    </section>
  );
}
