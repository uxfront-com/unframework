import { For, type JSX } from "solid-js";

export interface ReviewSummaryProps {
  steps: string[];
  score: number;
  sku: string;
  product: string;
}

export default function ReviewSummary(
  props: ReviewSummaryProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `review-summary ${props.class}` : "review-summary"}
      aria-label="Review"
      style={props.style}
    >
      <ol>
        <For each={props.steps}>{(step, index) => <li value={index()}>{step}</li>}</For>
      </ol>
      <meter min="0" max="10" value={props.score} aria-label="Score">
        {props.score} out of 10
      </meter>
      <p>
        Product: <data value={props.sku}>{props.product}</data>
      </p>
    </section>
  );
}
