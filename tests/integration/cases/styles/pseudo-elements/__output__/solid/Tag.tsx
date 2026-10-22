import type { JSX } from "solid-js";
import "./Tag.uf.tsx.css";

export default function Tag(
  props: { name: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <span
      class={props.class ? `tag ${props.class}` : "tag"}
      data-uf-ef5e671c=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.name}
    </span>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
