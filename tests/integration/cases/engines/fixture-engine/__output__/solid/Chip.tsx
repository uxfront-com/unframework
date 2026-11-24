import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, splitProps } from "solid-js";
import { chip } from "virtual:fixture-engine";
import "virtual:fixture-engine.css";

export default function Chip(
  props: { label: string; tone?: "plain" | "accent" } & Omit<
    ComponentProps<"span">,
    "label" | "tone" | "style"
  > & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["label", "tone", "class"]);

  return (
    <span class={cx(chip(props.tone), props.class)} {...others}>
      {props.label}
    </span>
  );
}
