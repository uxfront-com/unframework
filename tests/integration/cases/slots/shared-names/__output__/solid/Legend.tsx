import { For, type JSX } from "solid-js";

export interface LegendSlots {
  swatch?: (props: { item: string }) => JSX.Element;
  caption?: (props: { item: string }) => JSX.Element;
}

export default function Legend(
  props: { items: string[]; label: string } & LegendSlots & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  return (
    <ul
      aria-label={props.label}
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <For each={props.items}>
        {(item) => (
          <li>
            <span>{props.swatch?.({ item })}</span> <span>{props.caption?.({ item })}</span>
          </li>
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
