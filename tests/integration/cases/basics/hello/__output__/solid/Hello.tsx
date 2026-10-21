import type { JSX } from "solid-js";

export default function Hello(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <p
      class={props.class ? `greeting ${props.class}` : "greeting"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      Hello, world!
    </p>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
