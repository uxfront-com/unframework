import { component$, useSignal } from "@qwik.dev/core";
import type { QRL } from "@qwik.dev/core";

export interface EmitterProps {
  step?: number;
  onChange$?: QRL<(value: number) => void>;
}

// A counter as the target emits one: a signal, and a lazily loaded handler that writes it and
// emits through the event's QRL prop (test/events.browser.test.ts).
export default component$<EmitterProps>(({ step = 1, onChange$ }) => {
  const count = useSignal(0);
  return (
    <div>
      <p role="status">{count.value}</p>
      <button
        type="button"
        onClick$={async () => {
          count.value += step;
          await onChange$?.(count.value);
        }}
      >
        Add
      </button>
    </div>
  );
});
