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
