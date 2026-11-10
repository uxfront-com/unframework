import { For, type JSX, createSignal } from "solid-js";

const STEPS = [1, 5, 10] as const;
const LIMITS = Object.freeze({ min: 0, max: 20 });
const caption = (value: number): string => `${value} of ${LIMITS.max}`;
const START = LIMITS.min + 2;

export default function Stepper(props: { class?: string; style?: JSX.CSSProperties }) {
  const [value, setValue] = createSignal(START);

  function add(step: number) {
    setValue(Math.min(LIMITS.max, value() + step));
  }

  return (
    <section
      class={props.class ? `stepper ${props.class}` : "stepper"}
      aria-label="Stepper"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p role="status">{caption(value())}</p>
      <ul>
        <For each={STEPS}>
          {(step) => (
            <li>
              <button type="button" onClick={() => add(step)}>
                Add {step}
              </button>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
