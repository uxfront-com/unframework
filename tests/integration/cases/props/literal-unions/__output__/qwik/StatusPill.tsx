import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface StatusPillProps {
  status: "active" | "paused" | "archived";
  size?: "small" | "large";
  level?: 1 | 2 | 3;
}

export default component$<
  StatusPillProps &
    Omit<PropsOf<"span">, "status" | "size" | "level" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ status, size = "small", level = 1, class: className, style, ...attributes }) => {
  return (
    <span
      class={["pill", `pill-${status}`, `pill-${size}`, `pill-level-${level}`, className]}
      style={style}
      {...attributes}
    >
      {status === "active" ? "Active" : status === "paused" ? "Paused" : "Archived"}
      {level === 3 ? " (critical)" : ""}
    </span>
  );
});
