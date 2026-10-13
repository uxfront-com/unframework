import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface StatusPillProps {
  status: "active" | "paused" | "archived";
  size?: "small" | "large";
  level?: 1 | 2 | 3;
}

export default component$<StatusPillProps & { class?: ClassList; style?: CSSProperties }>(
  ({ status, size = "small", level = 1, class: className, style }) => {
    return (
      <span
        class={["pill", `pill-${status}`, `pill-${size}`, `pill-level-${level}`, className]}
        style={style}
      >
        {status === "active" ? "Active" : status === "paused" ? "Paused" : "Archived"}
        {level === 3 ? " (critical)" : ""}
      </span>
    );
  },
);
