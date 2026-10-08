import { component$ } from "@qwik.dev/core";

export const Hint = component$<{ text: string }>(({ text }) => {
  return <small class="hint">{text}</small>;
});
