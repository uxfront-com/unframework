import Badge from "./Badge";
import Tag from "./Tag";
import type { JSX } from "solid-js";

export default function Labels(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <section
      class={props.class ? `labels ${props.class}` : "labels"}
      aria-label="Labels"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Badge label="New" />
      <Tag name="docs" />
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
