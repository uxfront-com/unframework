import { component$ } from "@qwik.dev/core";

export default component$<{ label: string }>(({ label }) => {
  return <li class="item">{label}</li>;
});
