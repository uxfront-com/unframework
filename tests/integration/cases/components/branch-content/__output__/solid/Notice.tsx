import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Notice(
  props: { text: string; tone: "info" | "quiet" } & Omit<
    ComponentProps<"p">,
    "text" | "tone" | "style"
  > & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["text", "tone", "class"]);

  return (
    <p role="status" class={cx("notice", props.tone, props.class)} {...others}>
      {props.text}
    </p>
  );
}
