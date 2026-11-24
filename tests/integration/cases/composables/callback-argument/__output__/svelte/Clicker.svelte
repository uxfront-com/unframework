<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import { useCounter } from "./useCounter.svelte";
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "onlimit" | "children" | "class" | "style" | "ref"
  > & {
    onlimit?: (count: number) => void;
    class?: ClassValue;
    style?: string;
    ref?: HTMLElementTagNameMap["section"] | null;
  };

  let { onlimit, class: className, style, ref = $bindable(null), ...attributes }: Props = $props();

  let message = $state("Keep going");

  const counter = useCounter(3, (reached) => {
    message = `Reached ${reached}`;
    onlimit?.(reached);
  });
</script>

<section
  class={["clicker", className]}
  aria-label="Clicker"
  {style}
  bind:this={ref}
  {...attributes}
>
  <p role="status">Count: {counter.count}</p
  ><p>{message}</p
  ><button type="button" onclick={() => counter.increment()}>Add {counter.step}</button
  ><button type="button" onclick={() => counter.reset()}>Reset</button>
</section>
