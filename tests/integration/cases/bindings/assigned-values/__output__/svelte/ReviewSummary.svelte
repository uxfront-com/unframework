<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  export interface ReviewSummaryProps {
    steps: string[];
    score: number;
    sku: string;
    product: string;
  }
</script>

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type Props = ReviewSummaryProps & { class?: ClassValue; style?: string };

  let { steps, score, sku, product, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["review-summary", className]}
  aria-label="Review"
  {style}
  {...scopeAttributes(attributes)}
>
  <ol>
    {#each steps as step, index (step)}
      <li {...{ value: index }}>{step}</li>
    {/each}
  </ol
  ><meter min="0" max="10" {...{ value: score }} aria-label="Score">{score} out of 10</meter
  ><p>Product: <data {...{ value: sku }}>{product}</data></p>
</section>
