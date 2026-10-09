import { component$ } from "@qwik.dev/core";

export default component$<{ label: string }>(({ label }) => {
  return (
    <div class="card">
      <strong>{label}</strong>
    </div>
  );
});
