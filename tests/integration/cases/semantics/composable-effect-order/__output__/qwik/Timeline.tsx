import { useTracked } from "./useTracked";
import {
  $,
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"section">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const entries = useSignal<string[]>([]);

  const record = $((entry: string) => {
    entries.value = [...entries.value, entry];
  });

  useVisibleTask$(
    () => {
      entries.value = [...entries.value, "caller mounted first"];
    },
    { strategy: "document-ready" },
  );

  const { count, increment } = useTracked($((entry) => record(entry)));

  const previousCount = useSignal(() => count.value);
  useTask$(
    ({ track }) => {
      const value = track(count);
      if (Object.is(value, previousCount.value)) return;
      previousCount.value = value;
      entries.value = [...entries.value, "caller watcher"];
    },
    { deferUpdates: false },
  );

  useVisibleTask$(
    () => {
      entries.value = [...entries.value, "caller mounted last"];
    },
    { strategy: "document-ready" },
  );

  return (
    <section class={["timeline", className]} aria-label="Timeline" style={style} {...attributes}>
      <p role="status">Count: {count.value}</p>
      <button type="button" onClick$={() => increment()}>
        Increment
      </button>
      <ol>
        {entries.value.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
});
