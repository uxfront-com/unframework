<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  import type { ClassValue } from "svelte/elements";

  type LookupResult = { ok: true; match: string } | { ok: false; error: string };

  export interface FilterSummaryProps {
    tags: string | string[];
    limit: number | string;
    result: LookupResult;
  }

  type Props = FilterSummaryProps & { class?: ClassValue; style?: string };

  let { tags, limit, result, class: className, style }: Props = $props();
</script>

<section class={["filter-summary", className]} aria-label="Filters" {style}>
  <p>Tags: {Array.isArray(tags) ? tags.join(", ") : tags}</p
  ><p>Limit: {typeof limit === "number" ? limit.toFixed(0) : limit.toLowerCase()}</p
  >{#if result.ok}
    <p>Found {result.match}</p>
  {:else}
    <p>No match: {result.error}</p>
  {/if}
</section>
