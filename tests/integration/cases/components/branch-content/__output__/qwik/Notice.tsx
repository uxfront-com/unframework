import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { text: string; tone: "info" | "quiet" } & Omit<
    PropsOf<"p">,
    "text" | "tone" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ text, tone, class: className, style, ...attributes }) => {
  return (
    <p role="status" class={["notice", tone, className]} style={style} {...attributes}>
      {text}
    </p>
  );
});
