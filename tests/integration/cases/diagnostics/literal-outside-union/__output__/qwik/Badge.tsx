import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export const Badge = component$<
  { tone: "info" | "warning" } & { class?: ClassList; style?: CSSProperties }
>(({ tone, class: className, style }) => {
  return (
    <span class={["badge", tone, className]} style={style}>
      {tone}
    </span>
  );
});
