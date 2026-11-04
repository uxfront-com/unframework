import { ref } from "unframework";

// The module's own constants (ADR-0070): a list, a frozen table, a plain function and a constant
// that reads another, all read-only, read by the component's template and its listeners.
const STEPS = [1, 5, 10] as const;
const LIMITS = Object.freeze({ min: 0, max: 20 });
const caption = (value: number): string => `${value} of ${LIMITS.max}`;
const START = LIMITS.min + 2;

export default function Stepper() {
  const value = ref(START);

  function add(step: number) {
    value.value = Math.min(LIMITS.max, value.value + step);
  }

  return (
    <section class="stepper" aria-label="Stepper">
      <p role="status">{caption(value.value)}</p>
      <ul>
        {STEPS.map((step) => (
          <li key={step}>
            <button type="button" onClick={() => add(step)}>
              Add {step}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
