import Item from "./Item";
import { For, type JSX } from "solid-js";

export default function Menu(
  props: { entries: string[] } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ul aria-label="Menu" class={props.class} style={props.style}>
      <For each={props.entries}>{(entry) => <Item label={entry} />}</For>
    </ul>
  );
}
