import { $, type QRL, component$, useSignal } from "@qwik.dev/core";

export interface PickerEvents {
  onDone$?: QRL<(step: number, status: string) => void>;
}

export default component$<PickerEvents>(({ onDone$ }) => {
  const selected = useSignal("none");
  const hits = useSignal(0);
  const log = useSignal<string[]>([]);
  const status = useSignal("idle");
  const step = useSignal(0);

  const record = $((line: string) => {
    log.value = [...log.value, line];
  });

  const report = $(async () => {
    await record(`picked ${selected.value} #${hits.value}`);
  });

  const load = $(async () => {
    status.value = "loading";
    await Promise.resolve();
    step.value += 1;
  });

  const run = $(async () => {
    step.value += 1;
    await load();
    status.value = `loaded ${step.value}`;
    await nextTick();
    onDone$?.(step.value, status.value);
  });

  const start = $(() => {
    void run();
    status.value = "started";
  });

  return (
    <section class="picker" aria-label="Picker">
      <div class="choices" role="presentation" onClick$={report}>
        <button
          type="button"
          onClick$={() => {
            selected.value = "alpha";
            hits.value += 1;
          }}
        >
          Alpha
        </button>
        <button
          type="button"
          onClick$={() => {
            selected.value = "beta";
            hits.value += 1;
          }}
        >
          Beta
        </button>
      </div>
      <ol aria-label="Log">
        {log.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
      <p role="status">{status.value}</p>
      <button type="button" onClick$={start}>
        Start
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
