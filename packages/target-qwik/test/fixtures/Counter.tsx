import { component$, useSignal } from "@qwik.dev/core";

// Interactive: its server render carries state, vnode data and an event registration script.
export default component$(() => {
  const count = useSignal(0);
  return (
    <div class="counter">
      <output>{count.value}</output>
      <button type="button" onClick$={() => count.value++}>
        +1
      </button>
    </div>
  );
});
