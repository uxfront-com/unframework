import type { JSX } from "solid-js";
import "./Blue.uf.tsx.css";

export interface BlueSlots {
  children?: JSX.Element;
}

export default function Blue(props: BlueSlots & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div
      class={props.class ? `blue ${props.class}` : "blue"}
      data-uf-721c504a=""
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
