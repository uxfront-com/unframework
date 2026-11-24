import type { BadgeProps } from "./types";
import type { ComponentProps, JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";

export default function Badge(
  rawProps: BadgeProps &
    Omit<ComponentProps<"span">, "label" | "tone" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const props = merge(rawProps, {
    get tone() {
      return rawProps.tone === undefined ? "info" : rawProps.tone;
    },
  });
  const others = omit(props, "label", "tone", "class");

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
