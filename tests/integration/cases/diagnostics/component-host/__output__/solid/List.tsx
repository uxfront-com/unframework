import Row from "./Row";
import type { JSX } from "solid-js";
import "./List.uf.tsx.css";

export default function List(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div
      class={props.class ? `list ${props.class}` : "list"}
      data-uf-ced7d23e=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Row text="One" data-uf-ced7d23e="" />
      <Row text="Two" data-uf-ced7d23e="" />
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
