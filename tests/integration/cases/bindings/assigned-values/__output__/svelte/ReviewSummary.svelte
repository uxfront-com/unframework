<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  export interface ReviewSummaryProps {
    steps: string[];
    score: number;
    sku: string;
    product: string;
  }

  let { steps, score, sku, product }: ReviewSummaryProps = $props();
</script>

<section class="review-summary" aria-label="Review">
  <ol>
    {#each steps as step, index (step)}
      <li {...{ value: index }}>{step}</li>
    {/each}
  </ol
  ><meter min="0" max="10" {...{ value: score }} aria-label="Score">{score} out of 10</meter
  ><p>Product: <data {...{ value: sku }}>{product}</data></p>
</section>
