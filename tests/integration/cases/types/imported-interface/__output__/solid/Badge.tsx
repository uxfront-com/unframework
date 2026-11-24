import type { BadgeProps } from "./types";
import { type ComponentProps, type JSX, mergeProps, splitProps } from "solid-js";

export default function Badge(
  rawProps: BadgeProps &
    Omit<ComponentProps<"span">, "label" | "tone" | "style"> & { style?: JSX.CSSProperties },
) {
  const props = mergeProps({ tone: "info" } satisfies Partial<BadgeProps>, rawProps);
  const [, others] = splitProps(props, ["label", "tone", "class"]);

  return (
    <span class={cx(`badge badge-${props.tone}`, props.class)} {...others}>
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
