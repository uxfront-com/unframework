import type { JSX } from "solid-js";
import "./Frame.uf.tsx.css";

export interface FrameSlots {
  children?: JSX.Element;
  label?: (props: { text: string }) => JSX.Element;
}

export default function Frame(props: FrameSlots & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <figure
      class={props.class ? `frame ${props.class}` : "frame"}
      data-uf-9dc516fd=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.children}
      {props.label?.({ text: "Harbour at dusk" })}
    </figure>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
