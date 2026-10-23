import type { JSX } from "solid-js";

export default function Item(
  props: { label: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <li
      class={props.class ? `item ${props.class}` : "item"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.label}
    </li>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
