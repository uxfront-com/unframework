export interface ReviewSummaryProps {
  steps: string[];
  score: number;
  sku: string;
  product: string;
}

export default function ReviewSummary({ steps, score, sku, product }: ReviewSummaryProps) {
  return (
    <section class="review-summary" aria-label="Review">
      <ol>
        {steps.map((step, index) => (
          <li key={step} value={index}>
            {step}
          </li>
        ))}
      </ol>
      <meter min="0" max="10" value={score} aria-label="Score">
        {score} out of 10
      </meter>
      <p>
        Product: <data value={sku}>{product}</data>
      </p>
    </section>
  );
}
