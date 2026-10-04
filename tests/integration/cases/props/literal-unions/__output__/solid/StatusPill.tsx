import { mergeProps } from "solid-js";

export interface StatusPillProps {
  status: "active" | "paused" | "archived";
  size?: "small" | "large";
  level?: 1 | 2 | 3;
}

export default function StatusPill(rawProps: StatusPillProps) {
  const props = mergeProps(
    { size: "small", level: 1 } satisfies Partial<StatusPillProps>,
    rawProps,
  );
  return (
    <span
      class={cx("pill", `pill-${props.status}`, `pill-${props.size}`, `pill-level-${props.level}`)}
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
