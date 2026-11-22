import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface ReviewSummaryProps {
  steps: string[];
  score: number;
  sku: string;
  product: string;
}

export interface ReviewSummaryAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
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
