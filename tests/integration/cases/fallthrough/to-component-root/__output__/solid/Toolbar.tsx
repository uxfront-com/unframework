import Primary from "./Primary";
import type { JSX } from "solid-js";

export default function Toolbar(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div
      role="toolbar"
      aria-label="Actions"
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Primary text="Save" class="wide" />
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
