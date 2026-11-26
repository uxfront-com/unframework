import { cx } from "./_unframework/cx";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Row(
  props: { name: string; done: boolean } & Omit<
    ComponentProps<"div">,
    "name" | "done" | "class" | "style"
  > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "name", "done", "class");

  return (
    <div role="listitem" class={cx("row", { done: props.done }, props.class)} {...others}>
      {props.name}
      {props.done ? " (done)" : ""}
    </div>
  );
}
