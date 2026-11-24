<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["span"],
    "symbol" | "children" | "class" | "style" | "ref"
  > & {
    symbol: string;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["span"] | null;
  };

  let { symbol, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();
</script>

<span
  class={["icon", className]}
  aria-hidden="true"
  {style}
  bind:this={ref}
  {...attributes}
>{symbol}</span>
