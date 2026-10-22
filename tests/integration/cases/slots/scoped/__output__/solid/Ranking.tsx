import List from "./List";
import type { JSX } from "solid-js";

export default function Ranking(
  props: { names: string[] } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div class={props.class} style={props.style} {...scopeAttributes(props)}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
