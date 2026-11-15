import { vNote } from "./vNote";
import type { JSX } from "solid-js";

export default function Note(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <em
      data-name="note"
      ref={vNote(() => "note")}
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      Note
    </em>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
