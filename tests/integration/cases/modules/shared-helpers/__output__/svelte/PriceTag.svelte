<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { formatPrice, pluralise } from "./format";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "cents" | "onorder" | "children" | "class" | "style" | "ref"
  > & {
    cents: number;
    onorder?: (summary: string) => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let {
    cents,
    onorder,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();

  let quantity = $state(1);
  const total = $derived(formatPrice(cents * quantity));

  function order() {
    onorder?.(`${pluralise(quantity, "item")} for ${total}`);
  }
</script>

<section
  class={["price-tag", className]}
  aria-label="Price"
  {style}
  bind:this={ref}
  {...attributes}
>
  <p>Each: {formatPrice(cents)}</p
  ><p role="status">{pluralise(quantity, "item")}: {total}</p
  ><button type="button" onclick={() => quantity++}>One more</button
  ><button type="button" onclick={order}>Order</button>
</section>
