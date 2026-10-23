import type { JSX } from "solid-js";

export default function Heading(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <h3
      class={props.class ? `heading ${props.class}` : "heading"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.text}
    </h3>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
