import type { JSX } from "solid-js";
import "./Mat.uf.tsx.css";

export interface MatSlots {
  children?: JSX.Element;
}

export default function Mat(props: MatSlots & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div
      class={props.class ? `mat ${props.class}` : "mat"}
      data-uf-09929c4a=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.children}
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
