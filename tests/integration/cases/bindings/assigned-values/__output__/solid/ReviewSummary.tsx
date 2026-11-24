import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface ReviewSummaryProps {
  steps: string[];
  score: number;
  sku: string;
  product: string;
}

export default function ReviewSummary(
  props: ReviewSummaryProps &
    Omit<ComponentProps<"section">, "steps" | "score" | "sku" | "product" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["steps", "score", "sku", "product", "class"]);

  return (
    <section
      class={props.class ? `review-summary ${props.class}` : "review-summary"}
      aria-label="Review"
      {...others}
    >
      <ol>
        <KeyedFor each={props.steps} by={(step) => step}>
          {(step) => <li value={step.index}>{step.value}</li>}
        </KeyedFor>
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
