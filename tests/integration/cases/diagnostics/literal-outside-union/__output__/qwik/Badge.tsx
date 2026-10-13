import { component$ } from "@qwik.dev/core";

export const Badge = component$<{ tone: "info" | "warning" }>(({ tone }) => {
  return <span class={["badge", tone]}>{tone}</span>;
});
