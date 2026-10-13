import { component$ } from "@qwik.dev/core";

export const Field = component$<{ label: string }>(({ label }) => {
  return (
    <label>
      {label} <input type="text" />
    </label>
  );
});
