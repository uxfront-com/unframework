import type { JSX } from "solid-js";

export interface CardSlots {
  title?: JSX.Element;
}

export default function Card(props: CardSlots & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div
      class={props.class ? `card ${props.class}` : "card"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h3>{props.title ?? "Untitled"}</h3>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
