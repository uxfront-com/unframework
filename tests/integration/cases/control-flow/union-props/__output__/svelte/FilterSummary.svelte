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
  import type { ClassValue } from "svelte/elements";

  type Props = FilterSummaryProps & { class?: ClassValue; style?: string };

  let { tags, limit, result, class: className, style, ...attributes }: Props = $props();

  /** The scope attributes of the styled parents that render this component, for its root. */
  function scopeAttributes(props: object): Record<string, ""> {
    const scope: Record<string, ""> = {};
    for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
    return scope;
  }
</script>

<section
  class={["filter-summary", className]}
  aria-label="Filters"
  {style}
  {...scopeAttributes(attributes)}
>
  <p>Tags: {Array.isArray(tags) ? tags.join(", ") : tags}</p
  ><p>Limit: {typeof limit === "number" ? limit.toFixed(0) : limit.toLowerCase()}</p
  >{#if result.ok}
    <p>Found {result.match}</p>
  {:else}
    <p>No match: {result.error}</p>
  {/if}
</section>
