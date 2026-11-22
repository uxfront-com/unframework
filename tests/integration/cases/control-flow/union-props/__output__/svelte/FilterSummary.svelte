<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts" module>
  type LookupResult = { ok: true; match: string } | { ok: false; error: string };

  export interface FilterSummaryProps {
    tags: string | string[];
    limit: number | string;
    result: LookupResult;
  }
</script>

<script lang="ts">
  import type { ClassValue, SvelteHTMLElements } from "svelte/elements";

  type Props = Omit<
    SvelteHTMLElements["section"],
    "tags" | "limit" | "result" | "children" | "class" | "style" | "ref"
  > &
    FilterSummaryProps & {
      class?: ClassValue;
      style?: string;
      ref?: HTMLElementTagNameMap["section"] | null;
    };

  let {
    tags,
    limit,
    result,
    class: className,
    style,
    ref = $bindable(null),
    ...attributes
  }: Props = $props();
</script>

<section
  class={["filter-summary", className]}
  aria-label="Filters"
  {style}
  bind:this={ref}
  {...attributes}
>
  <p>Tags: {Array.isArray(tags) ? tags.join(", ") : tags}</p
  ><p>Limit: {typeof limit === "number" ? limit.toFixed(0) : limit.toLowerCase()}</p
  >{#if result.ok}
    <p>Found {result.match}</p>
  {:else}
    <p>No match: {result.error}</p>
  {/if}
</section>
