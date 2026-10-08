import { component$ } from "@qwik.dev/core";

export const Pill = component$<{ text: string }>(({ text }) => {
  return <span class="pill">{text}</span>;
});
