import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface RowListSlots {
  children?: JSX.Element;
}

export default function RowList(
  props: { label: string; items: string[] } & RowListSlots &
    Omit<ComponentProps<"ul">, "label" | "items" | "children" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label", "items", "children", "class"]);

  return (
    <ul
      class={props.class ? `row-list ${props.class}` : "row-list"}
      aria-label={props.label}
      {...others}
    >
      <KeyedFor each={props.items} by={(item) => item}>
        {(item) => (
          <li>
            {item.value} {props.children}
          </li>
        )}
      </KeyedFor>
    </ul>
  );
}
