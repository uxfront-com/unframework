import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";

export default component$<
  { label: string; size?: "sm" | "lg"; tone?: "neutral" | "primary" } & Omit<
    PropsOf<"button">,
    "label" | "size" | "tone" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ label, size, tone, class: className, style, ...attributes }) => {
  return (
    <button type="button" class={[button({ size, tone }), className]} style={style} {...attributes}>
      {label}
    </button>
  );
});
