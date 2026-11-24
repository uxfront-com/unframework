import { type ComponentProps, type JSX, splitProps } from "solid-js";

export function CardIcon(
  props: { symbol: string } & Omit<ComponentProps<"span">, "symbol" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["symbol", "class"]);

  return (
    <span class={props.class ? `icon ${props.class}` : "icon"} aria-hidden="true" {...others}>
      {props.symbol}
    </span>
  );
}
