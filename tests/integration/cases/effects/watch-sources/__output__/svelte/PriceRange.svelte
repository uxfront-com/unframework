<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface PriceRangeProps {
    currency: string;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue } from "svelte/elements";

  type Props = PriceRangeProps & {
    onspanupdate?: (span: number) => void;
    onrangeupdate?: (low: number, high: number) => void;
    oncurrencyupdate?: (currency: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let {
    currency,
    onspanupdate,
    onrangeupdate,
    oncurrencyupdate,
    class: className,
    style,
    ...attributes
  }: Props = $props();

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

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["price-range", className]}
  aria-label="Price range"
  {style}
  {...scopeAttributes(attributes)}
>
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
