import Button from "./Button";
import type { JSX } from "solid-js";
import "./Toolbar.uf.tsx.css";

export default function Toolbar(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div
      role="toolbar"
      aria-label="Actions"
      class={props.class ? `toolbar ${props.class}` : "toolbar"}
      data-uf-a33d603f=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Button text="Save" data-uf-a33d603f="" />
      <Button text="Cancel" data-uf-a33d603f="" />
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
