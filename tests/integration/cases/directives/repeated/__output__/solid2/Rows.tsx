import { KeyedFor } from "./_unframework/KeyedFor";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface RowsSlots {
  row?: JSX.Element;
}

export default function Rows(
  props: RowsSlots &
    Omit<ComponentProps<"div">, "row" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "row", "class");

  const [items, setItems] = createState([1, 2]);

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
