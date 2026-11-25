import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, splitProps } from "solid-js";
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";

export default function Button(
  props: { label: string; size?: "sm" | "lg"; tone?: "neutral" | "primary" } & Omit<
    ComponentProps<"button">,
    "label" | "size" | "tone" | "style"
  > & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["label", "size", "tone", "class"]);

  return (
    <button
      type="button"
      class={cx(button({ size: props.size, tone: props.tone }), props.class)}
      {...others}
    >
      {props.label}
    </button>
  );
}
