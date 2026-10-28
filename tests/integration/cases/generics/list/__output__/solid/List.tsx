import { For, type JSX } from "solid-js";

export interface ListProps<T> {
  label: string;
  items: T[];
  selected?: T;
}

export default function List(props: ListProps<T> & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <ul
      aria-label={props.label}
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <For each={props.items}>
        {(item) => (
          <li aria-current={item === props.selected ? "true" : undefined}>{String(item)}</li>
        )}
      </For>
    </ul>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
