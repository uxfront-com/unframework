import type { JSX } from "solid-js";
import "./Amber.uf.tsx.css";

export interface AmberSlots {
  children?: JSX.Element;
}

export default function Amber(props: AmberSlots & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div
      class={props.class ? `amber ${props.class}` : "amber"}
      data-uf-c97301b3=""
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
