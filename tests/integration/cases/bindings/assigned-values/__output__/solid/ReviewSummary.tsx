import { type Accessor, For, type JSX, createMemo, untrack } from "solid-js";

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
      {...scopeAttributes(props)}
    >
      <ol>
        <KeyedFor each={props.steps} by={(step) => step}>
          {(step, index) => <li value={index()}>{step()}</li>}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (item: Accessor<T>, index: Accessor<number>) => JSX.Element;
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
        return untrack(() => props.children(item, index));
      }}
    </For>
  );
}
