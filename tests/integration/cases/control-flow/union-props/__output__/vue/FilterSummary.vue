<script setup lang="ts">
type LookupResult = { ok: true; match: string } | { ok: false; error: string };

export interface FilterSummaryProps {
  tags: string | string[];
  limit: number | string;
  result: LookupResult;
}

const { tags, limit, result } = defineProps<FilterSummaryProps>();
</script>

<template>
  <section class="filter-summary" aria-label="Filters">
    <p>Tags: {{ Array.isArray(tags) ? tags.join(", ") : tags }}</p>
    <p>Limit: {{ typeof limit === "number" ? limit.toFixed(0) : limit.toLowerCase() }}</p>
    <p v-if="result.ok">Found {{ result.match }}</p>
    <p v-else>No match: {{ result.error }}</p>
  </section>
</template>
