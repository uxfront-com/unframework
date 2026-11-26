import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface PickerProps<T> {
  items: T[];
}

export interface PickerSlots<T> {
  item?: (props: { item: T }) => JSX.Element;
}

export default function Picker<T>(
  props: PickerProps<T> &
    PickerSlots<T> &
    Omit<ComponentProps<"ul">, "items" | "item" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "items", "item");

  return (
    <ul {...others}>
      <KeyedFor each={props.items} by={(item, index) => index}>
        {(item) => <li>{props.item?.({ item: item.value })}</li>}
      </KeyedFor>
    </ul>
  );
}
