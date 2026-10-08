import { component$ } from "@qwik.dev/core";

export const Badge = component$<{ text: string }>(({ text }) => {
  return <span class="badge">{text}</span>;
});
