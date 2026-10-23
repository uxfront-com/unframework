import Item from "./Item";
import { For, type JSX } from "solid-js";

export default function Menu(
  props: { entries: string[] } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ul aria-label="Menu" class={props.class} style={props.style} {...scopeAttributes(props)}>
      <For each={props.entries}>{(entry) => <Item label={entry} />}</For>
    </ul>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
