import type { JSX } from "solid-js";

export interface PanelSlots {
  title?: JSX.Element;
}

export default function Panel(props: PanelSlots & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div
      class={props.class ? `panel ${props.class}` : "panel"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h4>{props.title ?? "Untitled"}</h4>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
