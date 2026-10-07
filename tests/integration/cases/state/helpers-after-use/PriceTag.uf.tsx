import { computed, ref, watch } from "unframework";

export interface PriceTagProps {
  /** The unit price, in cents. */
  price: number;
}

export default function PriceTag({ price }: PriceTagProps) {
  const quantity = ref(1);
  const unit = ref(formatCents(price));
  const summary = ref(describe());
  const total = computed(() => formatCents(price * quantity.value));
  const last = ref("none");

  watch(quantity, () => {
    last.value = describe();
  });

  function add() {
    quantity.value++;
    summary.value = describe();
  }

  function formatCents(cents: number): string {
    return `EUR ${(cents / 100).toFixed(2)}`;
  }

  function describe(): string {
    return `${quantity.value} at ${formatCents(price)}`;
  }

  return (
    <section class="price-tag" aria-label="Price">
      <p>Unit: {unit.value}</p>
      <p role="status">{summary.value}</p>
      <p>Total: {total.value}</p>
      <p>Last change: {last.value}</p>
      <button type="button" onClick={add}>
        Add one
      </button>
      <button type="button" onClick={() => (unit.value = formatCents(price * 2))}>
        Price two
      </button>
    </section>
  );
}
