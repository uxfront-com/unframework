import { For, type JSX } from "solid-js";

export interface OptionsSlots<T extends { value: string }> {
  option?: (props: { option: T }) => JSX.Element;
}

export default function Options<T extends { value: string }>(
  props: { options: T[] } & OptionsSlots<T> & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ul class={props.class} style={props.style} {...scopeAttributes(props)}>
      <For each={props.options}>{(option) => <li>{props.option?.({ option })}</li>}</For>
    </ul>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
