import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<
  { text: string; tone: "info" | "quiet" } & { class?: ClassList; style?: CSSProperties }
>(({ text, tone, class: className, style }) => {
  return (
    <p role="status" class={["notice", tone, className]} style={style}>
      {text}
    </p>
  );
});
