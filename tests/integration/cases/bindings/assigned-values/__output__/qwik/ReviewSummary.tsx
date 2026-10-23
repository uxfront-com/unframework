import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface ReviewSummaryProps {
  steps: string[];
  score: number;
  sku: string;
  product: string;
}

export default component$<ReviewSummaryProps & { class?: ClassList; style?: CSSProperties }>(
  ({ steps, score, sku, product, class: className, style, ...attributes }) => {
    return (
      <section
        class={["review-summary", className]}
        aria-label="Review"
        {...scopeAttributes(attributes)}
        style={style}
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
