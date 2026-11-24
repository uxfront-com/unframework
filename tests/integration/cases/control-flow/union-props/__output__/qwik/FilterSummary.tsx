import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

type LookupResult = { ok: true; match: string } | { ok: false; error: string };

export interface FilterSummaryProps {
  tags: string | string[];
  limit: number | string;
  result: LookupResult;
}

export default component$<
  FilterSummaryProps &
    Omit<PropsOf<"section">, "tags" | "limit" | "result" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ tags, limit, result, class: className, style, ...attributes }) => {
  return (
    <section
      class={["filter-summary", className]}
      aria-label="Filters"
      style={style}
      {...attributes}
    >
      <p>Tags: {Array.isArray(tags) ? tags.join(", ") : tags}</p>
      <p>Limit: {typeof limit === "number" ? limit.toFixed(0) : limit.toLowerCase()}</p>
      {result.ok ? <p>Found {result.match}</p> : <p>No match: {result.error}</p>}
    </section>
  );
});
