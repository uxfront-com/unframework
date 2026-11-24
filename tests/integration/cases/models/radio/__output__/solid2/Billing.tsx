import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver } from "solid-js";

export default function Billing(
  props: Omit<ComponentProps<"fieldset">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [plan, setPlan] = createState("monthly");

  return (
    <fieldset {...props}>
      <legend>Billing</legend>
      <label>
        <input
          type="radio"
          name="plan"
          value="monthly"
          checked={plan() === "monthly"}
          onChange={() => setPlan("monthly")}
        />{" "}
        Monthly
      </label>
      <label>
        <input
          type="radio"
          name="plan"
          value="yearly"
          checked={plan() === "yearly"}
          onChange={() => setPlan("yearly")}
        />{" "}
        Yearly
      </label>
      <output>Plan: {plan()}</output>
      <button type="button" onClick={() => setPlan("monthly")}>
        Reset
      </button>
    </fieldset>
  );
}

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
