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
}: ReviewSummaryProps & ReviewSummaryAttributes) {
  return (
    <section className={cx("review-summary", className)} aria-label="Review" style={style}>
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
