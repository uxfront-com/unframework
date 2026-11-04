import { computed, defineEmits, ref } from "unframework";

import { formatPrice, pluralise } from "./format";

export default function PriceTag({ cents }: { cents: number }) {
  const emit = defineEmits<{ order: [summary: string] }>();
  const quantity = ref(1);
  const total = computed(() => formatPrice(cents * quantity.value));

  function order() {
    emit("order", `${pluralise(quantity.value, "item")} for ${total.value}`);
  }

  return (
    <section class="price-tag" aria-label="Price">
      <p>Each: {formatPrice(cents)}</p>
      <p role="status">
        {pluralise(quantity.value, "item")}: {total.value}
      </p>
      <button type="button" onClick={() => quantity.value++}>
        One more
      </button>
      <button type="button" onClick={order}>
        Order
      </button>
    </section>
  );
}
