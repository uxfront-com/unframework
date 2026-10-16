import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface ReviewSummaryProps {
  steps: string[];
  score: number;
  sku: string;
  product: string;
}

export default component$<ReviewSummaryProps & { class?: ClassList; style?: CSSProperties }>(
  ({ steps, score, sku, product, class: className, style }) => {
    return (
      <section class={["review-summary", className]} aria-label="Review" style={style}>
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
  },
);
