import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, splitProps } from "solid-js";
import { badge } from "virtual:styleframe";
import "virtual:styleframe.css";

export default function Badge(
  props: { label: string } & Omit<ComponentProps<"span">, "label" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label", "class"]);

  return (
    <span class={cx(badge(), props.class)} {...others}>
      {props.label}
    </span>
  );
}
