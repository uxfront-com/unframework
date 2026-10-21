import type { JSX } from "solid-js";

export function Hint(props: { text: string } & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <small
      class={props.class ? `hint ${props.class}` : "hint"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.text}
    </small>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
