import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface TallyEvents {
  onTotal$?: QRL<(value: number) => void>;
  onSteps$?: QRL<(values: number[]) => void>;
  onLogged$?: QRL<(entries: string[]) => void>;
}

export default component$<TallyEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ onTotal$, onSteps$, onLogged$, class: className, style, ...attributes }) => {
    const count = useSignal(0);
    const trail = useSignal<string[]>([]);

    const addTwice = $(() => {
      count.value++;
      count.value++;
      onTotal$?.(count.value);
    });

    const addFive = $(() => {
      count.value += 5;
      onTotal$?.(count.value);
    });

    const countUp = $(() => {
      const seen: number[] = [];
      for (let step = 0; step < 3; step++) {
        count.value += 1;
        seen.push(count.value);
      }
      onSteps$?.(seen);
    });

    const addTen = $(() => {
      count.value += 10;
    });

    const addTenAndReport = $(async () => {
      await addTen();
      onTotal$?.(count.value);
    });

    const logBubble = $(() => {
      trail.value = [...trail.value, "bubble"];
      onLogged$?.(trail.value);
    });

    return (
      <section
        class={["tally", className]}
        aria-label="Tally"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p role="status">Count: {count.value}</p>
        <button type="button" onClick$={addTwice}>
          Add two
        </button>
        <button type="button" onClick$={addFive}>
          Add five
        </button>
        <button type="button" onClick$={countUp}>
          Count up three
        </button>
        <button type="button" onClick$={addTenAndReport}>
          Add ten
        </button>
        <button
          type="button"
          onClick$={logBubble}
          window:onClick$={(event, element) => {
            if (!element.contains(event.target as Node)) return;
            trail.value = [...trail.value, "capture"];
          }}
        >
          Log the phases
        </button>
        <p>Phases: {trail.value.join(" then ")}</p>
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
