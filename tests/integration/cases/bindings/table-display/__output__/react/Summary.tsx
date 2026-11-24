import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface SummaryProps {
  name: string;
  plan: string;
  seats: number;
}

export interface SummaryAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Summary({
  name,
  plan,
  seats,
  className,
  style,
  ...attributes
}: SummaryProps & SummaryAttributes) {
  return (
    <div
      className={cx("summary", className)}
      style={{ display: "table", borderSpacing: "8px 4px", ...style }}
      {...scopeAttributes(attributes)}
    >
      <div style={{ display: "table-caption", fontWeight: "700" }}>Account</div>
      <div style={{ display: "table-row" }}>
        <span style={{ display: "table-cell" }}>Name</span>
        <span style={{ display: "table-cell" }}>{name}</span>
      </div>
      <div style={{ display: "table-row" }}>
        <span style={{ display: "table-cell" }}>Plan</span>
        <span style={{ display: "table-cell" }}>
          {plan} for {seats} seats
        </span>
      </div>
      <p>
        Billed to <span style={{ display: "table-cell", padding: "0 4px" }}>{name}</span> monthly.
      </p>
    </div>
  );
}
