import { For } from "solid-js";

export interface ReviewSummaryProps {
  steps: string[];
  score: number;
  sku: string;
  product: string;
}

export default function ReviewSummary(props: ReviewSummaryProps) {
  return (
    <section class="review-summary" aria-label="Review">
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
