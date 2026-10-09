import { component$ } from "@qwik.dev/core";

export default component$<{ label: string }>(({ label }) => {
  return <span class="chip">{label}</span>;
});
