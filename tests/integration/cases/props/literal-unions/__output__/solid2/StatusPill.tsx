import type { ComponentProps, JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";

export interface StatusPillProps {
  status: "active" | "paused" | "archived";
  size?: "small" | "large";
  level?: 1 | 2 | 3;
}

export default function StatusPill(
  rawProps: StatusPillProps &
    Omit<ComponentProps<"span">, "status" | "size" | "level" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const props = merge(rawProps, {
    get size() {
      return rawProps.size === undefined ? "small" : rawProps.size;
    },
    get level() {
      return rawProps.level === undefined ? 1 : rawProps.level;
    },
  });
  const others = omit(props, "status", "size", "level", "class");

  return (
    <span
      class={cx(
        "pill",
        `pill-${props.status}`,
        `pill-${props.size}`,
        `pill-level-${props.level}`,
        props.class,
      )}
      {...others}
    >
      {props.status === "active" ? "Active" : props.status === "paused" ? "Paused" : "Archived"}
      {props.level === 3 ? " (critical)" : ""}
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
