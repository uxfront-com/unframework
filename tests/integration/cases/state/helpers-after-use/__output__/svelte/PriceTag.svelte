<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { untrack } from "svelte";

  export interface PriceTagProps {
    /** The unit price, in cents. */
    price: number;
  }

  let { price }: PriceTagProps = $props();

  let quantity = $state(1);
  let unit = $state(untrack(() => formatCents(price)));
  let summary = $state(describe());
  const total = $derived(formatCents(price * quantity));
  let last = $state("none");

  let previousQuantity = untrack(() => quantity);
  $effect.pre(() => {
    if (Object.is(quantity, previousQuantity)) return;
    previousQuantity = quantity;
    untrack(() => {
      last = describe();
    });
  });

  function add() {
    quantity++;
    summary = describe();
  }

  function formatCents(cents: number): string {
    return `EUR ${(cents / 100).toFixed(2)}`;
  }

  function describe(): string {
    return `${quantity} at ${formatCents(price)}`;
  }
</script>

<section class="price-tag" aria-label="Price">
  <p>Unit: {unit}</p
  ><p role="status">{summary}</p
  ><p>Total: {total}</p
  ><p>Last change: {last}</p
  ><button type="button" onclick={add}>Add one</button
  ><button type="button" onclick={() => (unit = formatCents(price * 2))}>Price two</button>
</section>
