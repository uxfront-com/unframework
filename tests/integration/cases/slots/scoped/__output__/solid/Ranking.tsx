import List from "./List";
import type { JSX } from "solid-js";

export default function Ranking(
  props: { names: string[] } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div class={props.class} style={props.style}>
      <List
        items={props.names}
        label="Podium"
        item={({ item, index }) => (
          <span>
            {index + 1}. <b>{item}</b>
          </span>
        )}
      />
      <List
        items={props.names}
        label="Initials"
        item={(entry) => <i>{entry.item.slice(0, 1)}</i>}
      />
    </div>
  );
}
