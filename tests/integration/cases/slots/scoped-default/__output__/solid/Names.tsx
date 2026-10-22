import { For, type JSX } from "solid-js";

export interface NamesSlots {
  children?: (props: { item: string }) => JSX.Element;
}

export default function Names(
  props: { names: string[] } & NamesSlots & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ul aria-label="Names" class={props.class} style={props.style} {...scopeAttributes(props)}>
      <For each={props.names}>{(item) => <li>{props.children?.({ item })}</li>}</For>
    </ul>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
