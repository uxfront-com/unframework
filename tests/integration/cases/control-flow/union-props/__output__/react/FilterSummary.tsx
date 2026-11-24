import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

type LookupResult = { ok: true; match: string } | { ok: false; error: string };

export interface FilterSummaryProps {
  tags: string | string[];
  limit: number | string;
  result: LookupResult;
}

export interface FilterSummaryAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
    >
      <p>Tags: {Array.isArray(tags) ? tags.join(", ") : tags}</p>
      <p>Limit: {typeof limit === "number" ? limit.toFixed(0) : limit.toLowerCase()}</p>
      {result.ok ? <p>Found {result.match}</p> : <p>No match: {result.error}</p>}
    </section>
  );
}
