import { defineEmits, ref, watch } from "unframework";

export interface PriceRangeProps {
  currency: string;
}

export default function PriceRange({ currency }: PriceRangeProps) {
  const emit = defineEmits<{
    spanUpdate: [span: number];
    rangeUpdate: [low: number, high: number];
    currencyUpdate: [currency: string];
  }>();

  const low = ref(10);
  const high = ref(50);

  watch(
    () => high.value - low.value,
    (span) => {
      emit("spanUpdate", span);
    },
  );

  watch([low, high], ([minimum, maximum]) => {
    emit("rangeUpdate", minimum, maximum);
  });

  watch(
    () => currency,
    (value) => {
      emit("currencyUpdate", value);
    },
  );

  return (
    <section class="price-range" aria-label="Price range">
      <p role="status">
        {low.value} to {high.value} {currency}
      </p>
      <button
        type="button"
        onClick={() => {
          low.value += 10;
          high.value += 10;
        }}
      >
        Shift up
      </button>
      <button type="button" onClick={() => (high.value += 10)}>
        Widen
      </button>
    </section>
  );
}
