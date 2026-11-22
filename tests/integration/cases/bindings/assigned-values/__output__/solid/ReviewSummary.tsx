import { type ComponentProps, For, type JSX, createMemo, splitProps, untrack } from "solid-js";

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

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
}
