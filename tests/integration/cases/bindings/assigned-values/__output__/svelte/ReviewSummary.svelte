<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  export interface ReviewSummaryProps {
    steps: string[];
    score: number;
    sku: string;
    product: string;
  }

  type Props = ReviewSummaryProps & { class?: ClassValue; style?: string };

  let { steps, score, sku, product, class: className, style }: Props = $props();
</script>

<section class={["review-summary", className]} aria-label="Review" {style}>
  <ol>
    {#each steps as step, index (step)}
      <li {...{ value: index }}>{step}</li>
    {/each}
  </ol
  ><meter min="0" max="10" {...{ value: score }} aria-label="Score">{score} out of 10</meter
  ><p>Product: <data {...{ value: sku }}>{product}</data></p>
</section>
