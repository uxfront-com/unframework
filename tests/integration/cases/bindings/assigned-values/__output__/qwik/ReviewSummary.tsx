import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface ReviewSummaryProps {
  steps: string[];
  score: number;
  sku: string;
  product: string;
}

export default component$<
  ReviewSummaryProps &
    Omit<PropsOf<"section">, "steps" | "score" | "sku" | "product" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ steps, score, sku, product, class: className, style, ...attributes }) => {
  return (
    <section
      class={["review-summary", className]}
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
});
