import { component$ } from "@qwik.dev/core";

export default component$<{ text: string }>(({ text }) => {
  return <h3 class="heading">{text}</h3>;
});
