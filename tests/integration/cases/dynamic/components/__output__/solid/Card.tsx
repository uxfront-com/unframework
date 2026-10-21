import type { JSX } from "solid-js";

export default function Card(
  props: { label: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div
      class={props.class ? `card ${props.class}` : "card"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <strong>{props.label}</strong>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
