import { component$ } from "@qwik.dev/core";

export default component$<{ text: string }>(({ text }) => {
  return (
    <button type="button" class="base">
      {text}
    </button>
  );
});
