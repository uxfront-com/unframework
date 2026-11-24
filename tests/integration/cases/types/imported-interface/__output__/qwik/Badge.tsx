import type { BadgeProps } from "./types";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  BadgeProps &
    Omit<PropsOf<"span">, "label" | "tone" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, tone = "info", class: className, style, ...attributes }) => {
  return (
    <span class={[`badge badge-${tone}`, className]} style={style} {...attributes}>
      {label}
    </span>
  );
});
