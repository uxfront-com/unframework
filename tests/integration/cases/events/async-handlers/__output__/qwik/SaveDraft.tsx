import { $, type QRL, component$, useSignal } from "@qwik.dev/core";

export interface SaveDraftEvents {
  onSaved$?: QRL<(attempt: number, status: string) => void>;
}

export default component$<SaveDraftEvents>(({ onSaved$ }) => {
  const status = useSignal("Not saved");
  const attempts = useSignal(0);

  const save = $(async () => {
    status.value = "Saving";
    attempts.value += 1;
    await Promise.resolve();
    status.value = "Checking";
    await nextTick();
    status.value = `Saved, attempt ${attempts.value}`;
    onSaved$?.(attempts.value, status.value);
  });

  return (
    <section class="save-draft" aria-label="Draft">
      <p role="status">{status.value}</p>
      <button type="button" onClick$={save}>
        Save the draft
      </button>
    </section>
  );
});

/**
 * Resolves once Qwik has rendered the writes made before it: Qwik renders them in a microtask,
 * so they are in the DOM by the next task.
 */
function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}
