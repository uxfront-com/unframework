import { component$ } from "@qwik.dev/core";

export default component$<{ text: string; tone: "info" | "quiet" }>(({ text, tone }) => {
  return (
    <p role="status" class={["notice", tone]}>
      {text}
    </p>
  );
});
