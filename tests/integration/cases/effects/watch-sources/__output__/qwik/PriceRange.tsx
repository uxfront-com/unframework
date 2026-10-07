import { type QRL, component$, useComputed$, useSignal, useTask$ } from "@qwik.dev/core";

export interface PriceRangeProps {
  currency: string;
}

export interface PriceRangeEvents {
  onSpanUpdate$?: QRL<(span: number) => void>;
  onRangeUpdate$?: QRL<(low: number, high: number) => void>;
  onCurrencyUpdate$?: QRL<(currency: string) => void>;
}

export default component$<PriceRangeProps & PriceRangeEvents>(
  ({ currency, onSpanUpdate$, onRangeUpdate$, onCurrencyUpdate$ }) => {
    const low = useSignal(10);
    const high = useSignal(50);

    const spanSource = useComputed$(() => high.value - low.value);
    const previousSpan = useSignal(() => spanSource.value);
    useTask$(
      ({ track }) => {
        const span = track(spanSource);
        if (Object.is(span, previousSpan.value)) return;
        previousSpan.value = span;
        onSpanUpdate$?.(span);
      },
      { deferUpdates: false },
    );

    const previousValues = useSignal<[typeof low.value, typeof high.value]>(() => [
      low.value,
      high.value,
    ]);
    useTask$(
      ({ track }) => {
        const values: [typeof low.value, typeof high.value] = [track(low), track(high)];
        if (values.every((item, index) => Object.is(item, previousValues.value[index]))) return;
        previousValues.value = values;
        const [minimum, maximum] = values;
        onRangeUpdate$?.(minimum, maximum);
      },
      { deferUpdates: false },
    );

    const previousCurrency = useSignal(() => currency);
    useTask$(
      ({ track }) => {
        const value = track(() => currency);
        if (Object.is(value, previousCurrency.value)) return;
        previousCurrency.value = value;
        onCurrencyUpdate$?.(value);
      },
      { deferUpdates: false },
    );

    return (
      <section class="price-range" aria-label="Price range">
        <p role="status">
          {low.value} to {high.value} {currency}
        </p>
        <button
          type="button"
          onClick$={() => {
            low.value += 10;
            high.value += 10;
          }}
        >
          Shift up
        </button>
        <button type="button" onClick$={() => (high.value += 10)}>
          Widen
        </button>
      </section>
    );
  },
);
