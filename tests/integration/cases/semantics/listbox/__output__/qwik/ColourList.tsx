import { component$, useSignal } from "@qwik.dev/core";

export default component$(() => {
  const colour = useSignal("none");

  return (
    <section aria-label="Colours">
      <select
        size={3}
        aria-label="Colour"
        onChange$={(_, element) => (colour.value = (element as HTMLSelectElement).value)}
      >
        <option value="red">Red</option>
        <option value="green">Green</option>
        <option value="blue">Blue</option>
      </select>
      <output>Picked: {colour.value}</output>
    </section>
  );
});
