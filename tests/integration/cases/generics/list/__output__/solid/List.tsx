import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface ListProps<T> {
  label: string;
  items: T[];
  selected?: T;
}

export default function List<T>(
  props: ListProps<T> &
    Omit<ComponentProps<"ul">, "label" | "items" | "selected" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label", "items", "selected"]);

  return (
    <ul aria-label={props.label} {...others}>
      <KeyedFor each={props.items} by={(item, index) => index}>
        {(item) => (
          <li aria-current={item.value === props.selected ? "true" : undefined}>
            {String(item.value)}
          </li>
        )}
      </KeyedFor>
    </ul>
  );
}
