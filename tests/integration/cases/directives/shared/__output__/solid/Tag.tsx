import { vMark } from "./vMark";
import type { JSX } from "solid-js";

export interface TagProps {
  name: string;
}

export default function Tag(props: TagProps & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <em
      class={props.class ? `tag ${props.class}` : "tag"}
      ref={vMark(() => `tag ${props.name}`)}
      style={props.style}
      {...scopeAttributes(props)}
    >
      #{props.name}
    </em>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
