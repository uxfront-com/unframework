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
