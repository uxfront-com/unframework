import type { Sized, Toned } from "./types";
import type { ComponentProps, JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";

type ChipProps = Sized & Toned & { label: string };

export default function Chip(
  rawProps: ChipProps &
    Omit<ComponentProps<"span">, "size" | "tone" | "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const props = merge(rawProps, {
    get tone() {
      return rawProps.tone === undefined ? "neutral" : rawProps.tone;
    },
  });
  const others = omit(props, "size", "tone", "label", "class");

  return (
    <span class={cx(`chip chip-${props.size} chip-${props.tone}`, props.class)} {...others}>
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
