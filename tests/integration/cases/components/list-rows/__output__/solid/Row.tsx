import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Row(
  props: { name: string; done: boolean } & Omit<
    ComponentProps<"div">,
    "name" | "done" | "style"
  > & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["name", "done", "class"]);

  return (
    <div role="listitem" class={cx("row", { done: props.done }, props.class)} {...others}>
      {props.name}
      {props.done ? " (done)" : ""}
    </div>
  );
}
