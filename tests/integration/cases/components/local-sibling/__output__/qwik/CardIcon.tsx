import { component$ } from "@qwik.dev/core";

export const CardIcon = component$<{ symbol: string }>(({ symbol }) => {
  return (
    <span class="icon" aria-hidden="true">
      {symbol}
    </span>
  );
});
