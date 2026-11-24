import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface ListSlots {
  item?: (props: { item: string; index: number }) => JSX.Element;
}

export default function List(
  props: { items: string[]; label: string } & ListSlots &
    Omit<ComponentProps<"ul">, "items" | "label" | "item" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["items", "label", "item"]);

  return (
    <ul aria-label={props.label} {...others}>
      <KeyedFor each={props.items} by={(item) => item}>
        {(item) => <li>{props.item?.({ item: item.value, index: item.index })}</li>}
      </KeyedFor>
    </ul>
  );
}
