import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export interface RowsSlots {
  row?: JSX.Element;
}

export default function Rows(
  props: RowsSlots & Omit<ComponentProps<"div">, "row" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["row", "class"]);

  const [items, setItems] = createSignal([1, 2]);

  return (
    <div class={props.class ? `rows ${props.class}` : "rows"} {...others}>
      <ul>
        <KeyedFor each={items()} by={(item) => item}>
          {() => <li>{props.row}</li>}
        </KeyedFor>
      </ul>
      <button type="button" onClick={() => setItems([...items(), items().length + 1])}>
        Add row
      </button>
      <button type="button" onClick={() => setItems(items().slice(0, -1))}>
        Remove row
      </button>
    </div>
  );
}
