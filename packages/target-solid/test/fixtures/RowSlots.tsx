import { For, type JSX, Show, children } from "solid-js";

export interface RowSlotsSlots {
  badge?: JSX.Element;
}

export default function RowSlots(
  props: { items: string[] } & RowSlotsSlots & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ul class={props.class} style={props.style} {...scopeAttributes(props)}>
      <For each={props.items}>
        {(item) => {
          const badge = children(() => props.badge);
          return (
            <li>
              {item}
              <Show when={badge()}>
                <b>{badge()}</b>
              </Show>
            </li>
          );
        }}
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
