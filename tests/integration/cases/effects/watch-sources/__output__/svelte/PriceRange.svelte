<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";

  export interface PriceRangeProps {
    currency: string;
  }

  type Props = PriceRangeProps & {
    onspanupdate?: (span: number) => void;
    onrangeupdate?: (low: number, high: number) => void;
    oncurrencyupdate?: (currency: string) => void;
  };

  let { currency, onspanupdate, onrangeupdate, oncurrencyupdate }: Props = $props();

  let low = $state(10);
  let high = $state(50);

  const watchedSpan = $derived(high - low);
  let previousSpan = untrack(() => watchedSpan);
  $effect.pre(() => {
    const span = watchedSpan;
    if (Object.is(span, previousSpan)) return;
    previousSpan = span;
    untrack(() => {
      onspanupdate?.(span);
    });
  });

  let previousLowHigh = untrack((): [typeof low, typeof high] => [low, high]);
  $effect.pre(() => {
    const values: [typeof low, typeof high] = [low, high];
    if (values.every((value, index) => Object.is(value, previousLowHigh[index]))) return;
    previousLowHigh = values;
    untrack(() => {
      const [minimum, maximum] = values;
      onrangeupdate?.(minimum, maximum);
    });
  });

  let previousCurrency = untrack(() => currency);
  $effect.pre(() => {
    const value = currency;
    if (Object.is(value, previousCurrency)) return;
    previousCurrency = value;
    untrack(() => {
      oncurrencyupdate?.(value);
    });
  });
</script>

<section class="price-range" aria-label="Price range">
  <p role="status">{low} to {high} {currency}</p
  ><button
    type="button"
    onclick={() => {
      low += 10;
      high += 10;
    }}
  >Shift up</button
  ><button type="button" onclick={() => (high += 10)}>Widen</button>
</section>
