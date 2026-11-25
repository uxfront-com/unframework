import Item from "./Item";
import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Menu(
  props: { entries: string[] } & Omit<ComponentProps<"ul">, "entries" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["entries"]);

  return (
    <ul aria-label="Menu" {...others}>
      <KeyedFor each={props.entries} by={(entry) => entry}>
        {(entry) => <Item label={entry.value} />}
      </KeyedFor>
    </ul>
  );
}
