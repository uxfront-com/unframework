import { cx } from "./_unframework/cx";
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
