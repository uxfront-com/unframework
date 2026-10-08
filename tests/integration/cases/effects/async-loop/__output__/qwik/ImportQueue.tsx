import { $, type QRL, component$, useSignal, useTask$ } from "@qwik.dev/core";

export interface ImportQueueProps {
  files: string[];
}

export interface ImportQueueEvents {
  onProgress$?: QRL<(status: string, attempts: number) => void>;
}

export default component$<ImportQueueProps & ImportQueueEvents>(({ files, onProgress$ }) => {
  const status = useSignal("idle");
  const attempts = useSignal(0);

  const previousValues = useSignal<[typeof status.value, typeof attempts.value]>(() => [
    status.value,
    attempts.value,
  ]);
  useTask$(
    ({ track }) => {
      const values: [typeof status.value, typeof attempts.value] = [track(status), track(attempts)];
      if (values.every((item, index) => Object.is(item, previousValues.value[index]))) return;
      previousValues.value = values;
      const [nextStatus, nextAttempts] = values;
      onProgress$?.(nextStatus, nextAttempts);
    },
    { deferUpdates: false },
  );

  const importAll = $(async () => {
    status.value = "starting";
    for (const file of files) {
      attempts.value += 1;
      await nextTick();
      status.value = `imported ${file}`;
    }
    status.value = "done";
  });

  return (
    <section class="import-queue" aria-label="Import">
      <button type="button" onClick$={importAll}>
        Import all
      </button>
      <p role="status">
        {status.value}, {attempts.value} attempts
      </p>
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
