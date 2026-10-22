import { type JSX, children } from "solid-js";

export interface BoxSlots {
  title?: JSX.Element;
  children?: JSX.Element;
}

export default function Box(props: BoxSlots & { class?: string; style?: JSX.CSSProperties }) {
  const content = children(() => props.children);
  return (
    <div
      class={props.class ? `box ${props.class}` : "box"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h3>{props.title ?? "Untitled"}</h3>
      {content() ?? <p>No content</p>}
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
