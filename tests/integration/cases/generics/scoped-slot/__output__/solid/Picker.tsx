import { For, type JSX } from "solid-js";

export interface PickerProps<T> {
  items: T[];
}

export interface PickerSlots {
  item?: (props: { item: T }) => JSX.Element;
}

export default function Picker(
  props: PickerProps<T> & PickerSlots & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ul class={props.class} style={props.style} {...scopeAttributes(props)}>
      <For each={props.items}>{(item) => <li>{props.item?.({ item })}</li>}</For>
    </ul>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
