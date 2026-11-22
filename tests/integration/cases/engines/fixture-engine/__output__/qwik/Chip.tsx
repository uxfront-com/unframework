import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";
import { chip } from "virtual:fixture-engine";
import "virtual:fixture-engine.css";

export default component$<
  { label: string; tone?: "plain" | "accent" } & Omit<
    PropsOf<"span">,
    "label" | "tone" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ label, tone, class: className, style, ...attributes }) => {
  return (
    <span class={[chip(tone), className]} style={style} {...attributes}>
      {label}
    </span>
  );
});
