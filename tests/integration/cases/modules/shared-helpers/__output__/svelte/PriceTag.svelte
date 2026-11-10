<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { formatPrice, pluralise } from "./format";
  import type { ClassValue } from "svelte/elements";

  type Props = {
    cents: number;
    onorder?: (summary: string) => void;
    class?: ClassValue;
    style?: string;
  };

  let { cents, onorder, class: className, style, ...attributes }: Props = $props();

  let quantity = $state(1);
  const total = $derived(formatPrice(cents * quantity));

  function order() {
    onorder?.(`${pluralise(quantity, "item")} for ${total}`);
  }

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["price-tag", className]}
  aria-label="Price"
  {style}
  {...scopeAttributes(attributes)}
>
  <p>Each: {formatPrice(cents)}</p
  ><p role="status">{pluralise(quantity, "item")}: {total}</p
  ><button type="button" onclick={() => quantity++}>One more</button
  ><button type="button" onclick={order}>Order</button>
</section>
