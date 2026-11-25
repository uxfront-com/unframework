import { cx } from "./_unframework/cx";
import { type ComponentProps, type JSX, mergeProps, splitProps } from "solid-js";

export interface StatusPillProps {
  status: "active" | "paused" | "archived";
  size?: "small" | "large";
  level?: 1 | 2 | 3;
}

export default function StatusPill(
  rawProps: StatusPillProps &
    Omit<ComponentProps<"span">, "status" | "size" | "level" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const props = mergeProps(
    { size: "small", level: 1 } satisfies Partial<StatusPillProps>,
    rawProps,
  );
  const [, others] = splitProps(props, ["status", "size", "level", "class"]);

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
