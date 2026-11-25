import { cx } from "./_unframework/cx";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Notice(
  props: { text: string; tone: "info" | "quiet" } & Omit<
    ComponentProps<"p">,
    "text" | "tone" | "class" | "style"
  > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "text", "tone", "class");

  return (
    <p role="status" class={cx("notice", props.tone, props.class)} {...others}>
      {props.text}
    </p>
  );
}
