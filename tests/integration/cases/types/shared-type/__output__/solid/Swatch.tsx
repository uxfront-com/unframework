import type { Tone } from "./types";
import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Swatch(
  props: { tone: Tone } & Omit<ComponentProps<"span">, "tone" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["tone", "class"]);

  return (
    <span class={cx(`swatch swatch-${props.tone}`, props.class)} {...others}>
      {props.tone}
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
