import type { JSX } from "solid-js";

export function Header(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <header
      class={props.class ? `header ${props.class}` : "header"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      Site
    </header>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
