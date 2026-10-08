import { component$ } from "@qwik.dev/core";

export default component$<{ step: string }>(({ step }) => {
  return <p class="step">Step: {step}</p>;
});
