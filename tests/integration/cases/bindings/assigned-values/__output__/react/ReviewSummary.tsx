import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface ReviewSummaryProps {
  steps: string[];
  score: number;
  sku: string;
  product: string;
}

export type ReviewSummaryAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "steps" | "score" | "sku" | "product" | "children"
>;

export default function ReviewSummary({
  steps,
  score,
  sku,
  product,
  className,
  style,
  ...attributes
}: ReviewSummaryProps & ReviewSummaryAttributes) {
  return (
    <section
      className={cx("review-summary", className)}
      aria-label="Review"
      style={style}
      {...attributes}
    >
      <ol>
        {steps.map((step, index) => (
          <li key={step} value={index}>
            {step}
          </li>
        ))}
      </ol>
      <meter min={0} max={10} value={score} aria-label="Score">
        {score} out of 10
      </meter>
      <p>
        Product: <data value={sku}>{product}</data>
      </p>
    </section>
  );
}
