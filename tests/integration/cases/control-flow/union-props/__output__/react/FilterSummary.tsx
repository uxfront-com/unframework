import type { ComponentPropsWithRef } from "react";

type LookupResult = { ok: true; match: string } | { ok: false; error: string };

export interface FilterSummaryProps {
  tags: string | string[];
  limit: number | string;
  result: LookupResult;
}

export type FilterSummaryAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "tags" | "limit" | "result" | "children"
>;

export default function FilterSummary({
  tags,
  limit,
  result,
  className,
  style,
  ...attributes
}: FilterSummaryProps & FilterSummaryAttributes) {
  return (
    <section
      className={cx("filter-summary", className)}
      aria-label="Filters"
      style={style}
      {...attributes}
    >
      <p>Tags: {Array.isArray(tags) ? tags.join(", ") : tags}</p>
      <p>Limit: {typeof limit === "number" ? limit.toFixed(0) : limit.toLowerCase()}</p>
      {result.ok ? <p>Found {result.match}</p> : <p>No match: {result.error}</p>}
    </section>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
