import { styleObject } from "./_unframework/styleObject";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface BadgeProps {
  label: string;
  tone?: string;
}

export default component$<
  BadgeProps &
    Omit<PropsOf<"span">, "label" | "tone" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ label, tone, class: className, style, ...attributes }) => {
  return (
    <span class={["badge", className]} style={{ ...styleObject(tone), ...style }} {...attributes}>
      {label}
    </span>
  );
});
