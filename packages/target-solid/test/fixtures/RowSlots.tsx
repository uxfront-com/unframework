import { For, type JSX, Show, children } from "solid-js";

export interface RowSlotsSlots {
  badge?: JSX.Element;
}

export default function RowSlots(
  props: { items: string[] } & RowSlotsSlots & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <ul class={props.class} style={props.style}>
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
