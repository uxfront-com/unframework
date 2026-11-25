import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface NamesSlots {
  children?: (props: { item: string }) => JSX.Element;
}

export default function Names(
  props: { names: string[] } & NamesSlots &
    Omit<ComponentProps<"ul">, "names" | "children" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["names", "children"]);

  return (
    <ul aria-label="Names" {...others}>
      <KeyedFor each={props.names} by={(item) => item}>
        {(item) => <li>{props.children?.({ item: item.value })}</li>}
      </KeyedFor>
    </ul>
  );
}
