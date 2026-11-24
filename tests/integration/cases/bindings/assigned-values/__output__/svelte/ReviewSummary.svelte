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
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "steps" | "score" | "sku" | "product" | "children" | "class" | "style" | "ref"
  > &
    ReviewSummaryProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    steps,
    score,
    sku,
    product,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section
  class={["review-summary", className]}
  aria-label="Review"
  {style}
  bind:this={ref}
  {...attributes}
>
  <ol>
    {#each steps as step, index (step)}
      <li {...{ value: index }}>{step}</li>
    {/each}
  </ol
  ><meter min="0" max="10" {...{ value: score }} aria-label="Score">{score} out of 10</meter
  ><p>Product: <data {...{ value: sku }}>{product}</data></p>
</section>
