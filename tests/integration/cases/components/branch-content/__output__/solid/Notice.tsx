import type { JSX } from "solid-js";

export default function Notice(
  props: { text: string; tone: "info" | "quiet" } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <p role="status" class={cx("notice", props.tone, props.class)} style={props.style}>
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
