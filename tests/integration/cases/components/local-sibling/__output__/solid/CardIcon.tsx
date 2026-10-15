import type { JSX } from "solid-js";

export function CardIcon(
  props: { symbol: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <span
      class={props.class ? `icon ${props.class}` : "icon"}
      aria-hidden="true"
      style={props.style}
    >
      {props.symbol}
    </span>
  );
}
