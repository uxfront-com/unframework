import Level from "./Level";
import type { JSX } from "solid-js";

export default function Outline(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <Level title="Book" class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Level title="Part">
        <Level title="Chapter" />
      </Level>
      <Level title="Appendix" />
    </Level>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
