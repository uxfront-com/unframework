import type { JSX } from "solid-js";

export function CardIcon(
  props: { symbol: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <span
      class={props.class ? `icon ${props.class}` : "icon"}
      aria-hidden="true"
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.symbol}
    </span>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
