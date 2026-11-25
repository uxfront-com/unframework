import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface LegendSlots {
  swatch?: (props: { item: string }) => JSX.Element;
  caption?: (props: { item: string }) => JSX.Element;
}

export default function Legend(
  props: { items: string[]; label: string } & LegendSlots &
    Omit<ComponentProps<"ul">, "items" | "label" | "swatch" | "caption" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "items", "label", "swatch", "caption");

  return (
    <ul aria-label={props.label} {...others}>
      <KeyedFor each={props.items} by={(item) => item}>
        {(item) => (
          <li>
            <span>{props.swatch?.({ item: item.value })}</span>{" "}
            <span>{props.caption?.({ item: item.value })}</span>
          </li>
        )}
      </KeyedFor>
    </ul>
  );
}
