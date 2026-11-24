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

/** Joins class names: strings as they are, and the names of an object's truthy entries. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") names.push(part);
    else if (part && typeof part === "object") {
      for (const [name, on] of Object.entries(part)) if (on) names.push(name);
    }
  }
  return names.join(" ");
}
