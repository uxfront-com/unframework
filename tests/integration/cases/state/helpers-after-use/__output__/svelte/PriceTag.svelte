<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface PriceTagProps {
    /** The unit price, in cents. */
    price: number;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "price" | "children" | "class" | "style" | "ref"
  > &
    PriceTagProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let { price, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

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

<section
  class={["price-tag", className]}
  aria-label="Price"
  {style}
  bind:this={ref}
  {...attributes}
>
  <p>Unit: {unit}</p
  ><p role="status">{summary}</p
  ><p>Total: {total}</p
  ><p>Last change: {last}</p
  ><button type="button" onclick={add}>Add one</button
  ><button type="button" onclick={() => (unit = formatCents(price * 2))}>Price two</button>
</section>
