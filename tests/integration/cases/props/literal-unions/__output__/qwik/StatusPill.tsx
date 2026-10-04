import { component$ } from "@qwik.dev/core";

export interface StatusPillProps {
  status: "active" | "paused" | "archived";
  size?: "small" | "large";
  level?: 1 | 2 | 3;
}

export default component$<StatusPillProps>(({ status, size = "small", level = 1 }) => {
  return (
    <span class={["pill", `pill-${status}`, `pill-${size}`, `pill-level-${level}`]}>
      {status === "active" ? "Active" : status === "paused" ? "Paused" : "Archived"}
      {level === 3 ? " (critical)" : ""}
    </span>
  );
});
