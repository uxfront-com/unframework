import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

type LookupResult = { ok: true; match: string } | { ok: false; error: string };

export interface FilterSummaryProps {
  tags: string | string[];
  limit: number | string;
  result: LookupResult;
}

export default component$<FilterSummaryProps & { class?: ClassList; style?: CSSProperties }>(
  ({ tags, limit, result, class: className, style, ...attributes }) => {
    return (
      <section
        class={["filter-summary", className]}
        aria-label="Filters"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p>Tags: {Array.isArray(tags) ? tags.join(", ") : tags}</p>
        <p>Limit: {typeof limit === "number" ? limit.toFixed(0) : limit.toLowerCase()}</p>
        {result.ok ? <p>Found {result.match}</p> : <p>No match: {result.error}</p>}
      </section>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
