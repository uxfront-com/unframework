import Item from "./Item";
import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Menu(
  props: { entries: string[] } & Omit<ComponentProps<"ul">, "entries" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "entries");

  return (
    <ul aria-label="Menu" {...others}>
      <KeyedFor each={props.entries} by={(entry) => entry}>
        {(entry) => <Item label={entry.value} />}
      </KeyedFor>
    </ul>
  );
}
