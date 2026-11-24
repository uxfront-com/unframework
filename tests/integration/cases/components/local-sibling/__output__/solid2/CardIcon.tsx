import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export function CardIcon(
  props: { symbol: string } & Omit<ComponentProps<"span">, "symbol" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "symbol", "class");

  return (
    <span class={props.class ? `icon ${props.class}` : "icon"} aria-hidden="true" {...others}>
      {props.symbol}
    </span>
  );
}
