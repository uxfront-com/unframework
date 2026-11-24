import type { ComponentProps, JSX } from "@solidjs/web";
import { For, createMemo, omit, untrack } from "solid-js";

type Availability = "in-stock" | "backorder" | "discontinued";

interface Finish {
  sku: string;
  label: string;
}

export interface ProductSpecProps {
  name: string;
  availability: Availability;
  size: { width: number; depth: number; unit: "cm" | "in" };
  finishes: Finish[];
}

export default function ProductSpec(
  props: ProductSpecProps &
    Omit<
      ComponentProps<"section">,
      "name" | "availability" | "size" | "finishes" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "name", "availability", "size", "finishes", "class");

  return (
    <section
      class={props.class ? `product-spec ${props.class}` : "product-spec"}
      aria-label={props.name}
      {...others}
    >
      <h2>{props.name}</h2>
      <dl>
        <dt>Availability</dt>
        <dd>{props.availability}</dd>
        <dt>Size</dt>
        <dd>
          {props.size.width} × {props.size.depth} {props.size.unit}
        </dd>
      </dl>
      <ul>
        <KeyedFor each={props.finishes} by={(finish) => finish.sku}>
          {(finish) => (
            <li>
              {finish.value.label} ({finish.value.sku})
            </li>
          )}
        </KeyedFor>
      </ul>
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
