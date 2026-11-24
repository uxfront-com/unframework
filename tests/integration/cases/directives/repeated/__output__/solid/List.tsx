import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface ListSlots {
  item?: (props: { item: string }) => JSX.Element;
}

export default function List(
  props: { items: string[] } & ListSlots &
    Omit<ComponentProps<"ol">, "items" | "item" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["items", "item"]);

  return (
    <ol {...others}>
      <KeyedFor each={props.items} by={(item) => item}>
        {(item) => <li>{props.item?.({ item: item.value })}</li>}
      </KeyedFor>
    </ol>
  );
}
