import { $, type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

const STEPS = [1, 5, 10] as const;
const LIMITS = Object.freeze({ min: 0, max: 20 });
const caption = (value: number): string => `${value} of ${LIMITS.max}`;
const START = LIMITS.min + 2;

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const value = useSignal(START);

    const add = $((step: number) => {
      value.value = Math.min(LIMITS.max, value.value + step);
    });

    return (
      <section
        class={["stepper", className]}
        aria-label="Stepper"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <p role="status">{caption(value.value)}</p>
        <ul>
          {STEPS.map((step) => (
            <li key={step}>
              <button type="button" onClick$={() => add(step)}>
                Add {step}
              </button>
            </li>
          ))}
        </ul>
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
