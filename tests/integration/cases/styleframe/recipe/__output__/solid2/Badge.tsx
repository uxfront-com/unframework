import { cx } from "./_unframework/cx";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import { badge } from "virtual:styleframe";
import "virtual:styleframe.css";

export default function Badge(
  props: { label: string } & Omit<ComponentProps<"span">, "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "class");

  return (
    <span class={cx(badge(), props.class)} {...others}>
      {props.label}
    </span>
  );
}
