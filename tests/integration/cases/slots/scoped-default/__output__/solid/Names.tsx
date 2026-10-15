import { For, type JSX } from "solid-js";

export interface NamesSlots {
  children?: (props: { item: string }) => JSX.Element;
}

export default function Names(
  props: { names: string[] } & NamesSlots & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ul aria-label="Names" class={props.class} style={props.style}>
      <For each={props.names}>{(item) => <li>{props.children?.({ item })}</li>}</For>
    </ul>
  );
}
