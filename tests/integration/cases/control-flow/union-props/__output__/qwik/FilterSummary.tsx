import { component$ } from "@qwik.dev/core";

type LookupResult = { ok: true; match: string } | { ok: false; error: string };

export interface FilterSummaryProps {
  tags: string | string[];
  limit: number | string;
  result: LookupResult;
}

export default component$<FilterSummaryProps>(({ tags, limit, result }) => {
  return (
    <section class="filter-summary" aria-label="Filters">
      <p>Tags: {Array.isArray(tags) ? tags.join(", ") : tags}</p>
      <p>Limit: {typeof limit === "number" ? limit.toFixed(0) : limit.toLowerCase()}</p>
      {result.ok ? <p>Found {result.match}</p> : <p>No match: {result.error}</p>}
    </section>
  );
});
