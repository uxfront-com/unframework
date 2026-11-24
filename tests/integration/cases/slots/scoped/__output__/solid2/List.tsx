import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface ListSlots {
  item?: (props: { item: string; index: number }) => JSX.Element;
}

export default function List(
  props: { items: string[]; label: string } & ListSlots &
    Omit<ComponentProps<"ul">, "items" | "label" | "item" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "items", "label", "item");

  return (
    <ul aria-label={props.label} {...others}>
      <KeyedFor each={props.items} by={(item) => item}>
        {(item) => <li>{props.item?.({ item: item.value, index: item.index })}</li>}
      </KeyedFor>
    </ul>
  );
}
