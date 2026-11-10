import { useMediaQuery } from "./useMediaQuery";
import type { JSX } from "solid-js";

export default function Layout(props: { class?: string; style?: JSX.CSSProperties }) {
  const { matches: wide } = useMediaQuery("(min-width: 1px)");
  const { matches: tiny } = useMediaQuery("(max-width: 1px)");

  return (
    <section
      class={props.class ? `layout ${props.class}` : "layout"}
      aria-label="Layout"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p role="status">{wide() ? "Wide layout" : "Narrow layout"}</p>
      <p>{tiny() ? "Tiny screen" : "Not a tiny screen"}</p>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
