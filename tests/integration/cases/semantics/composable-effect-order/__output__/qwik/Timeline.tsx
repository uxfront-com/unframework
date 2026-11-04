import { useTracked } from "./useTracked";
import {
  $,
  type CSSProperties,
  type ClassList,
  component$,
  useSignal,
  useTask$,
  useVisibleTask$,
} from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
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
      <section
        class={["timeline", className]}
        aria-label="Timeline"
        {...scopeAttributes(attributes)}
        style={style}
      >
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
