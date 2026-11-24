import Field from "./Field";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver } from "solid-js";

export default function SignUp(
  props: Omit<ComponentProps<"form">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [focuses, setFocuses] = createState(0);

  return (
    <form aria-label="Sign up" {...props}>
      <p id="email-hint">We never share it.</p>
      <Field
        label="Email"
        id="email"
        aria-describedby="email-hint"
        placeholder="you@example.com"
        class="wide"
        style={{ "margin-top": "4px" }}
        onFocus={() => setFocuses(focuses() + 1)}
      />
      <p>Focuses: {focuses()}</p>
    </form>
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
