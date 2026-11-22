<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import Counter from "./Counter.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<SvelteHTMLElements["div"], "children" | "class" | "style" | "ref"> & {
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["div"] | null;
  };

  let { class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let counter: { increment(): void; reset(): void } | null = null;
</script>

<div class={["controls", className]} {style} bind:this={ref} {...attributes}>
  <Counter bind:this={counter} start={10}
  /><button type="button" onclick={() => counter?.increment()}>More</button
  ><button type="button" onclick={() => counter?.reset()}>Reset</button>
</div>
