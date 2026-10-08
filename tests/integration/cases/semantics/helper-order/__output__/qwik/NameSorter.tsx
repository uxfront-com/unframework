import {
  $,
  type QRL,
  component$,
  useComputed$,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface NameSorterEvents {
  onStarted$?: QRL<(text: string) => void>;
  onFirstSeen$?: QRL<(text: string) => void>;
  onSecondSeen$?: QRL<(count: number) => void>;
  onTotal$?: QRL<(letters: number) => void>;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export default component$<NameSorterEvents>(
  ({ onStarted$, onFirstSeen$, onSecondSeen$, onTotal$ }) => {
    const names = useSignal(["Cy", "Al"].toSorted((a, b) => compare(a, b)));
    const count = useSignal(0);
    const doubled = useComputed$(() => count.value * 2);

    useVisibleTask$(
      () => {
        function describe(): string {
          return `doubled ${doubled.value}`;
        }

        onStarted$?.(`first ${describe()}`);
      },
      { strategy: "document-ready" },
    );

    useVisibleTask$(
      () => {
        onStarted$?.("second");
      },
      { strategy: "document-ready" },
    );

    const previousCount = useSignal(() => count.value);
    useTask$(
      ({ track }) => {
        const value = track(count);
        if (Object.is(value, previousCount.value)) return;
        previousCount.value = value;
        function describe(): string {
          return `doubled ${doubled.value}`;
        }

        onFirstSeen$?.(describe());
      },
      { deferUpdates: false },
    );

    const previousCount_1 = useSignal(() => count.value);
    useTask$(
      ({ track }) => {
        const value = track(count);
        if (Object.is(value, previousCount_1.value)) return;
        previousCount_1.value = value;
        onSecondSeen$?.(value);
      },
      { deferUpdates: false },
    );

    const letters = useComputed$(() => names.value.join("").length);

    const add = $((name: string) => {
      names.value = [...names.value, name].toSorted(compare);
      count.value += 1;
    });

    const report = $(() => {
      onTotal$?.(letters.value);
    });

    return (
      <section class="name-sorter" aria-label="Names">
        <p>Names: {names.value.join(", ")}</p>
        <p>Added: {count.value}</p>
        <button type="button" onClick$={() => add("Bo")}>
          Add Bo
        </button>
        <button type="button" onClick$={report}>
          Report
        </button>
      </section>
    );
  },
);
