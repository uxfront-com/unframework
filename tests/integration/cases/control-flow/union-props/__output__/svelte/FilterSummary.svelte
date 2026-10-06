<svelte:options runes={true} preserveWhitespace={false} />

<script lang="ts">
  type LookupResult = { ok: true; match: string } | { ok: false; error: string };

  export interface FilterSummaryProps {
    tags: string | string[];
    limit: number | string;
    result: LookupResult;
  }

  let { tags, limit, result }: FilterSummaryProps = $props();
</script>

<section class="filter-summary" aria-label="Filters">
  <p>Tags: {Array.isArray(tags) ? tags.join(", ") : tags}</p
  ><p>Limit: {typeof limit === "number" ? limit.toFixed(0) : limit.toLowerCase()}</p
  >{#if result.ok}
    <p>Found {result.match}</p>
  {:else}
    <p>No match: {result.error}</p>
  {/if}
</section>
