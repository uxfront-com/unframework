import { KeyedFor } from "./_unframework/KeyedFor";
import { enumeratedValue } from "./_unframework/enumeratedValue";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface ListProps<T> {
  label: string;
  items: T[];
  selected?: T;
}

export default function List<T>(
  props: ListProps<T> &
    Omit<ComponentProps<"ul">, "label" | "items" | "selected" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "items", "selected");

  return (
    <ul aria-label={props.label} {...others}>
      <KeyedFor each={props.items} by={(item, index) => index}>
        {(item) => (
          <li aria-current={enumeratedValue(item.value === props.selected ? "true" : undefined)}>
            {String(item.value)}
          </li>
        )}
      </KeyedFor>
    </ul>
  );
}
