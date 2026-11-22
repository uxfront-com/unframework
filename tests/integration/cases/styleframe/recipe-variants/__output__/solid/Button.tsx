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
