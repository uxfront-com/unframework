import { KeyedFor } from "./_unframework/KeyedFor";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface Entry {
  id: number;
  html: string;
}

export interface ChangelogProps {
  entries: Entry[];
}

export default function Changelog(
  props: ChangelogProps &
    Omit<ComponentProps<"ul">, "entries" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "entries", "class");

  return (
    <ul class={props.class ? `changelog ${props.class}` : "changelog"} {...others}>
      <KeyedFor each={props.entries} by={(entry) => entry.id}>
        {(entry) => <li innerHTML={entry.value.html} />}
      </KeyedFor>
    </ul>
  );
}
