import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface SummaryProps {
  name: string;
  plan: string;
  seats: number;
}

export type SummaryAttributes = Omit<
  ComponentPropsWithRef<"div">,
  "name" | "plan" | "seats" | "children"
>;

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
      {...attributes}
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
