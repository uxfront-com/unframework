import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface EachSlotSlots {
  row?: (props: { item: string }) => JSX.Element;
}

export default function EachSlot(
  props: { items: string[] } & EachSlotSlots &
    Omit<ComponentProps<"span">, "items" | "row" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "items", "row", "class");

  return (
    <span class={props.class ? `each-slot ${props.class}` : "each-slot"} {...others}>
      <KeyedFor each={props.items} by={(item) => item}>
        {(item) => <span class="each-row">{props.row?.({ item: item.value })}</span>}
      </KeyedFor>
    </span>
  );
}
