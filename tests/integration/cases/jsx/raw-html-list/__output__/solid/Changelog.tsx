import { KeyedFor } from "./_unframework/KeyedFor";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface Entry {
  id: number;
  html: string;
}

export interface ChangelogProps {
  entries: Entry[];
}

export default function Changelog(
  props: ChangelogProps &
    Omit<ComponentProps<"ul">, "entries" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["entries", "class"]);

  return (
    <ul class={props.class ? `changelog ${props.class}` : "changelog"} {...others}>
      <KeyedFor each={props.entries} by={(entry) => entry.id}>
        {(entry) => <li innerHTML={entry.value.html} />}
      </KeyedFor>
    </ul>
  );
}
