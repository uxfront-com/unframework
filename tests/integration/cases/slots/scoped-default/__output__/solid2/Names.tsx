import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface NamesSlots {
  children?: (props: { item: string }) => JSX.Element;
}

export default function Names(
  props: { names: string[] } & NamesSlots &
    Omit<ComponentProps<"ul">, "names" | "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "names", "children");

  return (
    <ul aria-label="Names" {...others}>
      <KeyedFor each={props.names} by={(item) => item}>
        {(item) => <li>{props.children?.({ item: item.value })}</li>}
      </KeyedFor>
    </ul>
  );
}
