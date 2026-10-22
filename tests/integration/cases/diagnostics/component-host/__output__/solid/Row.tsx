import type { JSX } from "solid-js";

export default function Row(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div
      class={props.class ? `row ${props.class}` : "row"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.text}
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
