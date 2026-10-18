import { component$ } from "@qwik.dev/core";

export default component$<{ label: string }>(({ label }) => {
  return (
    <label class="field">
      {label} <input name={label.toLowerCase()} />
    </label>
  );
});
